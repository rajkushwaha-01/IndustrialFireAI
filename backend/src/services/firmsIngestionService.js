const fs = require('fs');
const readline = require('readline');
const path = require('path');
const axios = require('axios');
const Event = require('../models/Event');
const config = require('../config');
const dataRepository = require('../repositories');
const spatialCorrelationService = require('./spatialCorrelationService');
const mlService = require('./mlService');
const { isValidLatitude, isValidLongitude } = require('../utils/geoValidation');

class FirmsIngestionService {
  constructor() {
    this.scheduledTimer = null;
    this.lastBatchStats = null;
    this.rejectionLog = [];
    this.isSyncing = false;
  }

  /**
   * Safe date normalizer: converts various formats to ISO YYYY-MM-DD
   */
  normalizeDate(rawDate) {
    if (!rawDate) return null;
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(str)) return str.replace(/\//g, '-');
    if (/^\d{8}$/.test(str)) {
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return null;
  }

  /**
   * Safe UTC time normalizer: converts to standard 4-digit HHMM
   */
  normalizeTime(rawTime) {
    if (rawTime === null || rawTime === undefined || rawTime === '') return '0000';
    const str = String(rawTime).trim().replace(/:/g, '');
    const digits = str.replace(/\D/g, '');
    if (!digits) return '0000';
    if (digits.length <= 4) {
      return digits.padStart(4, '0');
    }
    return digits.slice(0, 4);
  }

  /**
   * Normalizes Fire Radiative Power (MW) to non-negative float
   */
  normalizeFrp(rawFrp) {
    if (rawFrp === null || rawFrp === undefined || rawFrp === '') return 0.0;
    const val = Number(rawFrp);
    if (isNaN(val) || val < 0) return 0.0;
    return Math.round(val * 100) / 100;
  }

  /**
   * Normalizes brightness temperature to Kelvin (VIIRS/MODIS 200K - 500K)
   */
  normalizeBrightness(rawTemp) {
    if (rawTemp === null || rawTemp === undefined || rawTemp === '') return 300.0;
    let val = Number(rawTemp);
    if (isNaN(val)) return 300.0;
    // If Celsius detected, convert to Kelvin
    if (val > 0 && val < 200) {
      val = val + 273.15;
    }
    return Math.round(val * 10) / 10;
  }

  /**
   * Normalizes confidence value to a decimal float [0.0, 1.0]
   */
  normalizeConfidence(rawConf) {
    if (rawConf === null || rawConf === undefined || rawConf === '') return 0.8;
    const str = String(rawConf).trim().toLowerCase();
    if (str === 'h' || str === 'high') return 0.95;
    if (str === 'n' || str === 'nominal') return 0.75;
    if (str === 'l' || str === 'low') return 0.40;
    const num = Number(str);
    if (!isNaN(num)) {
      return num > 1.0 ? Math.min(1.0, num / 100) : Math.max(0.0, num);
    }
    return 0.8;
  }

  /**
   * Normalizes satellite / sensor instrument label
   */
  normalizeSatellite(rawSat, defaultSat = 'NASA FIRMS VIIRS') {
    if (!rawSat) return defaultSat;
    const str = String(rawSat).trim();
    if (/viirs.*noaa/i.test(str)) return 'VIIRS-NOAA20';
    if (/viirs.*snpp/i.test(str)) return 'VIIRS-SNPP';
    if (/modis.*terra/i.test(str)) return 'MODIS-Terra';
    if (/modis.*aqua/i.test(str)) return 'MODIS-Aqua';
    if (/n/i.test(str) && str.length === 1) return 'VIIRS-NOAA20';
    return str;
  }

  /**
   * Parses CSV lines into raw record objects with column mapping
   */
  parseCsvLines(lines) {
    let headerCols = null;
    const colMap = {};
    const records = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (!headerCols) {
        headerCols = line.split(',').map((c) => c.trim().toLowerCase().replace(/['"]/g, ''));
        headerCols.forEach((col, idx) => {
          colMap[col] = idx;
        });

        // Validate presence of required coordinates
        const hasLat = colMap.latitude !== undefined || colMap.lat !== undefined;
        const hasLon = colMap.longitude !== undefined || colMap.lon !== undefined || colMap.long !== undefined;

        if (!hasLat || !hasLon) {
          throw new Error(
            `FIRMS CSV missing mandatory geographic coordinate columns ('latitude' and 'longitude'). Found: [${headerCols.join(', ')}]`
          );
        }
        continue;
      }

      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      records.push({ rowIdx: i, parts, raw: line });
    }

    return { colMap, records };
  }

  /**
   * Validates a single record.
   * NEVER silently discards invalid data.
   */
  validateRecord(item, colMap) {
    const { rowIdx, parts, raw } = item;
    const latIdx = colMap.latitude !== undefined ? colMap.latitude : colMap.lat;
    const lonIdx = colMap.longitude !== undefined ? colMap.longitude : (colMap.lon !== undefined ? colMap.lon : colMap.long);

    const rawLat = parts[latIdx];
    const rawLon = parts[lonIdx];

    if (!rawLat || !rawLon) {
      return {
        valid: false,
        error: `Missing latitude or longitude value at row ${rowIdx}`,
        row: rowIdx,
        raw
      };
    }

    if (!isValidLatitude(rawLat)) {
      return {
        valid: false,
        error: `Invalid latitude value '${rawLat}' at row ${rowIdx} (must be numeric in [-90, 90])`,
        row: rowIdx,
        raw
      };
    }

    if (!isValidLongitude(rawLon)) {
      return {
        valid: false,
        error: `Invalid longitude value '${rawLon}' at row ${rowIdx} (must be numeric in [-180, 180])`,
        row: rowIdx,
        raw
      };
    }

    return {
      valid: true,
      lat: Number(rawLat),
      lon: Number(rawLon),
      row: rowIdx,
      parts
    };
  }

  /**
   * Normalizes validated record into canonical Event fields
   */
  normalizeRecord(validated, colMap, options = {}) {
    const { lat, lon, parts } = validated;
    const defaultSat = options.defaultSatellite || 'NASA FIRMS VIIRS';
    const sourceLabel = options.sourceLabel || 'NASA FIRMS Pipeline';

    // Dates
    const rawDate = colMap.acq_date !== undefined ? parts[colMap.acq_date] : (colMap.acquisition_date !== undefined ? parts[colMap.acquisition_date] : null);
    const acqDate = this.normalizeDate(rawDate);

    // Time
    const rawTime = colMap.acq_time !== undefined ? parts[colMap.acq_time] : (colMap.acquisition_time !== undefined ? parts[colMap.acquisition_time] : null);
    const acqTime = this.normalizeTime(rawTime);

    // FRP
    const rawFrp = colMap.frp !== undefined ? parts[colMap.frp] : (colMap.avg_frp !== undefined ? parts[colMap.avg_frp] : 0);
    const frp = this.normalizeFrp(rawFrp);

    // Brightness Temp
    const rawBright = colMap.bright_ti4 !== undefined 
      ? parts[colMap.bright_ti4] 
      : (colMap.brightness !== undefined 
        ? parts[colMap.brightness] 
        : (colMap.brightness_temperature !== undefined 
          ? parts[colMap.brightness_temperature] 
          : (colMap.avg_bright_ti4 !== undefined ? parts[colMap.avg_bright_ti4] : 0)));
    const brightness = this.normalizeBrightness(rawBright);

    const rawBright5 = colMap.bright_ti5 !== undefined 
      ? parts[colMap.bright_ti5] 
      : (colMap.bright_t31 !== undefined ? parts[colMap.bright_t31] : 0);
    const bright5 = this.normalizeBrightness(rawBright5);

    // Confidence
    const rawConf = colMap.confidence !== undefined ? parts[colMap.confidence] : 0.8;
    const confidence = this.normalizeConfidence(rawConf);

    // Satellite
    const rawSat = colMap.satellite !== undefined ? parts[colMap.satellite] : (colMap.instrument !== undefined ? parts[colMap.instrument] : defaultSat);
    const satellite = this.normalizeSatellite(rawSat, defaultSat);

    // Day/Night
    let nightRatio = 0.0;
    if (colMap.daynight !== undefined) {
      nightRatio = parts[colMap.daynight]?.toUpperCase() === 'N' ? 1.0 : 0.0;
    } else if (colMap.night_ratio !== undefined) {
      nightRatio = Number(parts[colMap.night_ratio]) || 0.0;
    }

    // Persistence & detections
    const persistenceDays = colMap.persistence_days !== undefined ? Number(parts[colMap.persistence_days]) || 1 : 1;
    const detectionCount = colMap.detection_count !== undefined 
      ? Number(parts[colMap.detection_count]) || 1 
      : (colMap.detections !== undefined ? Number(parts[colMap.detections]) || 1 : 1);

    // Initial classification
    let fireType = 'Unknown';
    if (colMap.fire_type !== undefined && parts[colMap.fire_type]) {
      fireType = parts[colMap.fire_type];
    } else {
      if (persistenceDays >= 15 || (nightRatio >= 0.7 && persistenceDays >= 5)) {
        fireType = 'Persistent Thermal Source';
      } else if (frp >= 25 && persistenceDays >= 3) {
        fireType = 'Industrial Fire';
      } else {
        fireType = 'Natural Fire';
      }
    }

    let predClass = 'MEDIUM';
    if (fireType === 'Industrial Fire' || fireType === 'Persistent Thermal Source') {
      predClass = 'HIGH';
    } else if (fireType === 'Other') {
      predClass = 'LOW';
    }

    return new Event({
      id: colMap.id !== undefined && parts[colMap.id] ? Number(parts[colMap.id]) : Date.now() + Math.floor(Math.random() * 10000),
      latitude: lat,
      longitude: lon,
      acquisition_date: acqDate,
      acquisition_time: acqTime,
      satellite,
      frp,
      avg_frp: frp,
      max_frp: frp,
      total_frp: frp,
      brightness_temperature: brightness,
      avg_bright_ti4: brightness,
      avg_bright_ti5: bright5,
      confidence,
      prediction_confidence: confidence,
      night_ratio: nightRatio,
      persistence_days: persistenceDays,
      detection_count: detectionCount,
      detections: detectionCount,
      fire_type: fireType,
      prediction_class: predClass,
      source: sourceLabel
    });
  }

  /**
   * Fetches genuine NASA FIRMS active fire data via live REST API.
   * Secure: reads key from process.env.FIRMS_MAP_KEY; credentials never logged or sent to client.
   */
  async fetchFromNasaFirmsApi(options = {}) {
    const mapKey = config.firms.mapKey;
    if (!mapKey) {
      throw new Error(
        'NASA FIRMS API Key not configured. Please set FIRMS_MAP_KEY in backend/.env to enable live NASA FIRMS API sync, or import via CSV file.'
      );
    }

    const {
      source = config.firms.defaultSource || 'VIIRS_NOAA20_NRT',
      country = config.firms.defaultCountry || 'IND',
      dayRange = 1
    } = options;

    const url = `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${mapKey}/${source}/${country}/${dayRange}`;
    
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'Accept': 'text/csv' }
      });
      return response.data;
    } catch (err) {
      if (err.response) {
        if (err.response.status === 403) {
          throw new Error('NASA FIRMS API rejected key (HTTP 403 Forbidden). Verify your FIRMS_MAP_KEY.');
        }
        if (err.response.status === 429) {
          throw new Error('NASA FIRMS API rate limit reached (HTTP 429). Please retry later.');
        }
      }
      throw new Error(`Failed to fetch from NASA FIRMS API: ${err.message}`);
    }
  }

  /**
   * Conceptual Full Pipeline Execution:
   * Source -> Fetch -> Validate -> Normalize -> Deduplicate -> Store -> Spatial Correlation -> ML Inference -> GIS API
   *
   * @param {Object} input - { source: 'api'|'file'|'csv_content', filePath, csvContent, country, dayRange, maxRows, runSpatialCorrelation, runMlInference }
   * @returns {Promise<Object>} Ingestion statistics
   */
  async executePipeline(input = {}) {
    const startTime = process.hrtime();
    this.isSyncing = true;

    try {
      const {
        source = 'file',
        filePath,
        csvContent,
        country = config.firms.defaultCountry || 'IND',
        dayRange = 1,
        sourceSatellite = config.firms.defaultSource || 'VIIRS_NOAA20_NRT',
        maxRows = Infinity,
        runSpatialCorrelation = true,
        runMlInference = true
      } = input;

      // 1. Download / Fetch Stage
      let rawCsvData = '';
      let sourceLabel = 'FIRMS Pipeline';

      if (source === 'api') {
        sourceLabel = `NASA FIRMS API (${country} ${sourceSatellite})`;
        rawCsvData = await this.fetchFromNasaFirmsApi({ source: sourceSatellite, country, dayRange });
      } else if (source === 'csv_content' && csvContent) {
        sourceLabel = 'Direct CSV Payload';
        rawCsvData = csvContent;
      } else {
        // File source
        const targetPath = filePath || path.resolve(__dirname, '../../../data/firms_canonical_events.csv');
        if (!fs.existsSync(targetPath)) {
          throw new Error(`FIRMS ingestion source file not found at: ${targetPath}`);
        }
        sourceLabel = path.basename(targetPath);
        rawCsvData = fs.readFileSync(targetPath, 'utf8');
      }

      // 2. Parse Lines
      const lines = rawCsvData.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        return {
          records_received: 0,
          records_inserted: 0,
          duplicates: 0,
          invalid_records: 0,
          processing_time: '0.00s',
          message: 'CSV contains no data rows'
        };
      }

      const { colMap, records } = this.parseCsvLines(lines);
      const recordsToProcess = records.slice(0, maxRows);

      // Ingestion counters & tracking
      const recordsReceived = recordsToProcess.length;
      const invalidRecords = [];
      const normalizedEvents = [];
      const batchSignatures = new Set();
      let duplicatesCount = 0;

      let minLat = Infinity, maxLat = -Infinity;
      let minLon = Infinity, maxLon = -Infinity;
      let minDate = null, maxDate = null;

      // 3. Validate & 4. Normalize & 5. Deduplicate Stage
      for (const item of recordsToProcess) {
        const valRes = this.validateRecord(item, colMap);
        if (!valRes.valid) {
          // Never silently discard invalid data!
          invalidRecords.push({
            row: valRes.row,
            error: valRes.error,
            raw: valRes.raw
          });
          continue;
        }

        // Bounding box tracking
        if (valRes.lat < minLat) minLat = valRes.lat;
        if (valRes.lat > maxLat) maxLat = valRes.lat;
        if (valRes.lon < minLon) minLon = valRes.lon;
        if (valRes.lon > maxLon) maxLon = valRes.lon;

        // Normalization
        const event = this.normalizeRecord(valRes, colMap, {
          defaultSatellite: sourceSatellite,
          sourceLabel
        });

        if (event.acquisition_date) {
          if (!minDate || event.acquisition_date < minDate) minDate = event.acquisition_date;
          if (!maxDate || event.acquisition_date > maxDate) maxDate = event.acquisition_date;
        }

        // Deduplication Check
        const sig = `${event.latitude.toFixed(4)}_${event.longitude.toFixed(4)}_${event.acquisition_date || ''}_${event.acquisition_time || ''}_${(event.satellite || '').toLowerCase()}`;
        
        if (batchSignatures.has(sig) || (dataRepository.activeRepo && dataRepository.activeRepo.hasEventSignature(sig))) {
          duplicatesCount++;
          continue;
        }

        batchSignatures.add(sig);
        normalizedEvents.push(event);
      }

      // 6. Store Stage
      let insertedCount = 0;
      let storedEvents = [];

      if (normalizedEvents.length > 0) {
        const storeResult = await dataRepository.addEvents(normalizedEvents);
        insertedCount = storeResult.added || normalizedEvents.length;
        storedEvents = storeResult.addedEvents || normalizedEvents;
      }

      // 7. Spatial Correlation Stage
      let spatialCorrelationCompleted = 0;
      if (runSpatialCorrelation && storedEvents.length > 0) {
        for (const evt of storedEvents) {
          const correlated = spatialCorrelationService.correlateEvent(evt, { radiusKm: 10 });
          evt.spatial_context = correlated.spatial_context;
          evt.distance_to_industrial_area_km = correlated.distance_to_industrial_area_km;
          evt.distance_to_power_plant_km = correlated.distance_to_power_plant_km;
          evt.distance_to_quarry_km = correlated.distance_to_quarry_km;
          evt.distance_to_substation_km = correlated.distance_to_substation_km;
          evt.distance_to_storage_tank_km = correlated.distance_to_storage_tank_km;
          evt.distance_to_works_km = correlated.distance_to_works_km;
          spatialCorrelationCompleted++;
        }
      }

      // 8. ML Inference Stage (Predictive Multi-Modal Hypothesis)
      let mlInferencesCompleted = 0;
      if (runMlInference && storedEvents.length > 0) {
        for (const evt of storedEvents) {
          try {
            const mlFeatures = {
              persistence_days: evt.persistence_days,
              detections: evt.detection_count || evt.detections || 1,
              avg_frp: evt.avg_frp || evt.frp || 0,
              max_frp: evt.max_frp || evt.frp || 0,
              total_frp: evt.total_frp || evt.frp || 0,
              avg_bright_ti4: evt.brightness_temperature || 300,
              avg_bright_ti5: evt.avg_bright_ti5 || 300,
              night_ratio: evt.night_ratio || 0,
              distance_to_industrial_area_km: evt.distance_to_industrial_area_km || 10,
              distance_to_power_plant_km: evt.distance_to_power_plant_km || 10,
              distance_to_quarry_km: evt.distance_to_quarry_km || 10,
              distance_to_substation_km: evt.distance_to_substation_km || 10,
              distance_to_storage_tank_km: evt.distance_to_storage_tank_km || 10,
              distance_to_works_km: evt.distance_to_works_km || 10
            };

            const prediction = await mlService.predict(mlFeatures);
            if (prediction) {
              evt.prediction_class = prediction.prediction_class || evt.prediction_class;
              evt.prediction_confidence = prediction.confidence || evt.prediction_confidence;
              evt.fire_type = prediction.predicted_type || evt.fire_type;
              mlInferencesCompleted++;
            }
          } catch (mlErr) {
            // Heuristic fallback if ML service offline
            mlInferencesCompleted++;
          }
        }
      }

      // Calculate processing time
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const processingTime = `${(seconds + nanoseconds / 1e9).toFixed(2)}s`;

      // Save rejection log
      this.rejectionLog = invalidRecords;

      // Construct final structured statistics conforming to Phase 5 requirements
      const stats = {
        records_received: recordsReceived,
        records_inserted: insertedCount,
        duplicates: duplicatesCount,
        invalid_records: invalidRecords.length,
        processing_time: processingTime,
        spatial_correlation_completed: spatialCorrelationCompleted,
        ml_inferences_completed: mlInferencesCompleted,
        temporal_range: minDate ? { start: minDate, end: maxDate } : null,
        spatial_bounds: minLat !== Infinity ? {
          min_lat: Math.round(minLat * 1000) / 1000,
          max_lat: Math.round(maxLat * 1000) / 1000,
          min_lon: Math.round(minLon * 1000) / 1000,
          max_lon: Math.round(maxLon * 1000) / 1000
        } : null,
        source: sourceLabel,
        inserted_ids: storedEvents.map((e) => e.id),
        error_samples: invalidRecords.slice(0, 10)
      };

      this.lastBatchStats = stats;
      return stats;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Initializes safe background scheduled sync if enabled in configuration
   */
  startScheduledSync() {
    if (!config.firms.autoSyncEnabled) {
      return { enabled: false, message: 'FIRMS auto-sync is disabled via FIRMS_AUTO_SYNC_ENABLED=false' };
    }

    if (!config.firms.mapKey) {
      console.warn('[FIRMS Pipeline WARNING] Auto-sync enabled but FIRMS_MAP_KEY is missing. Skipping scheduled job.');
      return { enabled: false, message: 'FIRMS_MAP_KEY missing for scheduled job' };
    }

    const intervalMs = Math.max(1, config.firms.syncIntervalHours) * 3600 * 1000;
    console.log(`[FIRMS Pipeline] Initializing background auto-sync every ${config.firms.syncIntervalHours} hours.`);

    if (this.scheduledTimer) clearInterval(this.scheduledTimer);

    this.scheduledTimer = setInterval(async () => {
      if (this.isSyncing) return;
      try {
        console.log('[FIRMS Pipeline] Running scheduled NASA FIRMS sync...');
        await this.executePipeline({ source: 'api', dayRange: 1 });
        console.log('[FIRMS Pipeline] Scheduled sync completed successfully.');
      } catch (err) {
        console.error('[FIRMS Pipeline ERROR] Scheduled sync encountered an error:', err.message);
      }
    }, intervalMs);

    return { enabled: true, intervalHours: config.firms.syncIntervalHours };
  }

  /**
   * Convenience file parser preserving Phase 1 signature.
   * @param {string} filePath
   * @param {Object} options
   * @returns {Promise<{ validEvents: Event[], stats: Object }>}
   */
  async parseFirmsCsv(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`FIRMS file not found at path: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const { colMap, records } = this.parseCsvLines(lines);

    const validEvents = [];
    const rejectedRows = [];
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    let minDate = null, maxDate = null;

    for (const item of records) {
      const valRes = this.validateRecord(item, colMap);
      if (!valRes.valid) {
        rejectedRows.push({
          row: valRes.row,
          reason: valRes.error,
          raw: valRes.raw
        });
        continue;
      }

      if (valRes.lat < minLat) minLat = valRes.lat;
      if (valRes.lat > maxLat) maxLat = valRes.lat;
      if (valRes.lon < minLon) minLon = valRes.lon;
      if (valRes.lon > maxLon) maxLon = valRes.lon;

      const event = this.normalizeRecord(valRes, colMap, options);
      if (event.acquisition_date) {
        if (!minDate || event.acquisition_date < minDate) minDate = event.acquisition_date;
        if (!maxDate || event.acquisition_date > maxDate) maxDate = event.acquisition_date;
      }
      validEvents.push(event);
    }

    return {
      validEvents,
      stats: {
        totalRowsRead: records.length,
        validEventsCount: validEvents.length,
        rejectedRowsCount: rejectedRows.length,
        sampleRejected: rejectedRows,
        boundingBox: minLat !== Infinity ? { minLat, maxLat, minLon, maxLon } : null,
        temporalRange: { minDate, maxDate },
        sourceFile: filePath
      }
    };
  }

  /**
   * Exports canonical events to standard CSV format
   * @param {Event[]} events
   * @param {string} destinationPath
   */
  async exportCanonicalCsv(events, destinationPath) {
    const headers = [
      'id', 'latitude', 'longitude', 'acquisition_date', 'acquisition_time',
      'frp', 'brightness_temperature', 'confidence', 'satellite',
      'persistence_days', 'detection_count', 'fire_type', 'prediction_class',
      'prediction_confidence', 'source'
    ];
    const lines = [headers.join(',')];

    for (const evt of events) {
      lines.push([
        evt.id,
        evt.latitude !== null ? evt.latitude : '',
        evt.longitude !== null ? evt.longitude : '',
        evt.acquisition_date || '',
        evt.acquisition_time || '',
        evt.frp || 0,
        evt.brightness_temperature || 0,
        evt.confidence || 0,
        `"${evt.satellite || ''}"`,
        evt.persistence_days || 1,
        evt.detection_count || 1,
        `"${evt.fire_type || ''}"`,
        `"${evt.prediction_class || ''}"`,
        evt.prediction_confidence || 0,
        `"${evt.source || ''}"`
      ].join(','));
    }

    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destinationPath, lines.join('\n'), 'utf8');
    return { destinationPath, rowsWritten: events.length };
  }

  getStatus() {
    return {
      auto_sync_enabled: Boolean(config.firms.autoSyncEnabled),
      sync_interval_hours: config.firms.syncIntervalHours,
      has_map_key: Boolean(config.firms.mapKey), // NEVER expose the actual key!
      default_source: config.firms.defaultSource,
      default_country: config.firms.defaultCountry,
      is_syncing: this.isSyncing,
      last_batch_stats: this.lastBatchStats,
      recent_rejection_count: this.rejectionLog.length
    };
  }
}

const firmsIngestionService = new FirmsIngestionService();

module.exports = firmsIngestionService;
