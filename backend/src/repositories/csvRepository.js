const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Event = require('../models/Event');
const Infrastructure = require('../models/Infrastructure');

class CsvRepository {
  constructor() {
    this.events = [];
    this.eventsById = new Map();
    this.infrastructure = [];
    this.infrastructureById = new Map();
    this.infrastructureCategories = new Set();
    this.precomputedStats = null;
    this.isLoaded = false;
    this.loadPromise = null;
    this.eventsPath = null;
    this.infraPath = null;
  }

  resolveFilePaths() {
    const candidateDirs = [
      path.resolve(__dirname, '../../../data'),
      path.resolve(__dirname, '../../data'),
      path.resolve(process.cwd(), 'data')
    ];

    for (const dir of candidateDirs) {
      const ePath = path.join(dir, 'fire_dataset.csv.xls');
      const iPath = path.join(dir, 'osm_india_features.csv');
      if (fs.existsSync(ePath) && fs.existsSync(iPath)) {
        this.eventsPath = ePath;
        this.infraPath = iPath;
        return;
      }
    }

    // Default fallback
    this.eventsPath = path.resolve(process.cwd(), '../data/fire_dataset.csv.xls');
    this.infraPath = path.resolve(process.cwd(), '../data/osm_india_features.csv');
  }

  async init() {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.resolveFilePaths();
    console.log(`[CSV Repository] Initializing dataset from:\n  - Events: ${this.eventsPath}\n  - Infrastructure: ${this.infraPath}`);

    this.loadPromise = (async () => {
      const startTime = Date.now();
      await Promise.all([this.loadEvents(), this.loadInfrastructure()]);
      this.computeGlobalStats();
      this.isLoaded = true;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[CSV Repository] Dataset loaded successfully in ${duration}s.`);
      console.log(`  - Total Events: ${this.events.length}`);
      console.log(`  - Total Infrastructure Points: ${this.infrastructure.length}`);
    })();

    return this.loadPromise;
  }

  async loadEvents() {
    if (!fs.existsSync(this.eventsPath)) {
      console.warn(`[CSV Repository WARNING] Events file not found at ${this.eventsPath}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(this.eventsPath),
        crlfDelay: Infinity
      });

      let header = null;
      let idCounter = 1;

      rl.on('line', (line) => {
        if (!header) {
          header = line.split(',');
          return;
        }

        const parts = line.split(',');
        if (parts.length < 17) return;

        const event = new Event({
          id: idCounter++,
          persistence_days: parts[0],
          detections: parts[1],
          avg_frp: parts[2],
          max_frp: parts[3],
          total_frp: parts[4],
          avg_bright_ti4: parts[5],
          avg_bright_ti5: parts[6],
          night_ratio: parts[7],
          distance_to_industrial_area_km: parts[8],
          distance_to_power_plant_km: parts[9],
          distance_to_quarry_km: parts[10],
          distance_to_substation_km: parts[11],
          distance_to_storage_tank_km: parts[12],
          distance_to_works_km: parts[13],
          prediction_class: parts[14],
          prediction_confidence: parts[15],
          fire_type: parts[16]
        });

        this.events.push(event);
        this.eventsById.set(event.id, event);
      });

      rl.on('close', resolve);
      rl.on('error', reject);
    });
  }

  async loadInfrastructure() {
    if (!fs.existsSync(this.infraPath)) {
      console.warn(`[CSV Repository WARNING] Infrastructure file not found at ${this.infraPath}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: fs.createReadStream(this.infraPath),
        crlfDelay: Infinity
      });

      let header = null;
      let idCounter = 1;

      rl.on('line', (line) => {
        if (!header) {
          header = line.split(',');
          return;
        }

        const parts = line.split(',');
        if (parts.length < 3) return;

        const infra = new Infrastructure({
          id: idCounter++,
          latitude: parts[0],
          longitude: parts[1],
          feature_category: parts[2]
        });

        this.infrastructure.push(infra);
        this.infrastructureById.set(infra.id, infra);
        if (infra.feature_category) {
          this.infrastructureCategories.add(infra.feature_category);
        }
      });

      rl.on('close', resolve);
      rl.on('error', reject);
    });
  }

  computeGlobalStats() {
    const total = this.events.length;
    if (total === 0) {
      this.precomputedStats = { totalEvents: 0 };
      return;
    }

    const byClassification = {};
    const byPredictionClass = {};
    let minPersistence = Infinity;
    let maxPersistence = -Infinity;
    let sumPersistence = 0;

    let minFrp = Infinity;
    let maxFrp = -Infinity;
    let sumAvgFrp = 0;
    let sumTotalFrp = 0;

    let sumTi4 = 0;
    let sumTi5 = 0;

    let sumDistIndustrial = 0;
    let sumDistPower = 0;
    let sumDistQuarry = 0;
    let sumDistSubstation = 0;
    let sumDistStorage = 0;
    let sumDistWorks = 0;

    // Distribution Histograms
    const persistenceBins = { '1-5d': 0, '6-15d': 0, '16-30d': 0, '31-60d': 0, '60+d': 0 };
    const frpBins = { '0-5 MW': 0, '5-15 MW': 0, '15-30 MW': 0, '30-50 MW': 0, '50+ MW': 0 };
    const detectionBins = { '1-5': 0, '6-20': 0, '21-50': 0, '51-100': 0, '100+': 0 };

    const classComparisonAgg = {
      'Industrial Fire': { count: 0, pSum: 0, frpSum: 0, nightSum: 0, distIndSum: 0, distWorksSum: 0 },
      'Persistent Thermal Source': { count: 0, pSum: 0, frpSum: 0, nightSum: 0, distIndSum: 0, distWorksSum: 0 },
      'Natural Fire': { count: 0, pSum: 0, frpSum: 0, nightSum: 0, distIndSum: 0, distWorksSum: 0 }
    };

    let highConfIndustrial = 0;
    let highConfPersistent = 0;

    for (let i = 0; i < total; i++) {
      const e = this.events[i];

      // Fire type / classification breakdown
      byClassification[e.fire_type] = (byClassification[e.fire_type] || 0) + 1;

      // Prediction class breakdown
      byPredictionClass[e.prediction_class] = (byPredictionClass[e.prediction_class] || 0) + 1;

      if (e.prediction_class === 'HIGH') {
        if (e.fire_type === 'Industrial Fire') highConfIndustrial++;
        if (e.fire_type === 'Persistent Thermal Source') highConfPersistent++;
      }

      // Persistence
      if (e.persistence_days < minPersistence) minPersistence = e.persistence_days;
      if (e.persistence_days > maxPersistence) maxPersistence = e.persistence_days;
      sumPersistence += e.persistence_days;

      if (e.persistence_days <= 5) persistenceBins['1-5d']++;
      else if (e.persistence_days <= 15) persistenceBins['6-15d']++;
      else if (e.persistence_days <= 30) persistenceBins['16-30d']++;
      else if (e.persistence_days <= 60) persistenceBins['31-60d']++;
      else persistenceBins['60+d']++;

      // FRP
      if (e.avg_frp < minFrp) minFrp = e.avg_frp;
      if (e.max_frp > maxFrp) maxFrp = e.max_frp;
      sumAvgFrp += e.avg_frp;
      sumTotalFrp += e.total_frp;

      if (e.avg_frp <= 5) frpBins['0-5 MW']++;
      else if (e.avg_frp <= 15) frpBins['5-15 MW']++;
      else if (e.avg_frp <= 30) frpBins['15-30 MW']++;
      else if (e.avg_frp <= 50) frpBins['30-50 MW']++;
      else frpBins['50+ MW']++;

      // Detections
      if (e.detections <= 5) detectionBins['1-5']++;
      else if (e.detections <= 20) detectionBins['6-20']++;
      else if (e.detections <= 50) detectionBins['21-50']++;
      else if (e.detections <= 100) detectionBins['51-100']++;
      else detectionBins['100+']++;

      // Temperatures
      sumTi4 += e.avg_bright_ti4;
      sumTi5 += e.avg_bright_ti5;

      // Distances
      sumDistIndustrial += e.distance_to_industrial_area_km;
      sumDistPower += e.distance_to_power_plant_km;
      sumDistQuarry += e.distance_to_quarry_km;
      sumDistSubstation += e.distance_to_substation_km;
      sumDistStorage += e.distance_to_storage_tank_km;
      sumDistWorks += e.distance_to_works_km;

      // Class Comparison Aggregation
      if (classComparisonAgg[e.fire_type]) {
        const item = classComparisonAgg[e.fire_type];
        item.count++;
        item.pSum += e.persistence_days;
        item.frpSum += e.avg_frp;
        item.nightSum += e.night_ratio;
        item.distIndSum += e.distance_to_industrial_area_km;
        item.distWorksSum += e.distance_to_works_km;
      }
    }

    const classificationPct = {};
    for (const [key, count] of Object.entries(byClassification)) {
      classificationPct[key] = {
        count,
        percentage: Number(((count / total) * 100).toFixed(2))
      };
    }

    const classComparison = Object.entries(classComparisonAgg).map(([className, v]) => ({
      className,
      count: v.count,
      avgPersistence: Number((v.pSum / (v.count || 1)).toFixed(2)),
      avgFrp: Number((v.frpSum / (v.count || 1)).toFixed(2)),
      avgNightRatioPct: Number(((v.nightSum / (v.count || 1)) * 100).toFixed(1)),
      avgDistIndustrialKm: Number((v.distIndSum / (v.count || 1)).toFixed(2)),
      avgDistWorksKm: Number((v.distWorksSum / (v.count || 1)).toFixed(2))
    }));

    this.precomputedStats = {
      totalEvents: total,
      byClassification: classificationPct,
      byPredictionClass,
      highConfidenceStats: {
        total: byPredictionClass['HIGH'] || 0,
        industrialCount: highConfIndustrial,
        persistentCount: highConfPersistent,
        targetPrecision: 100
      },
      persistence: {
        min: minPersistence,
        max: maxPersistence,
        avg: Number((sumPersistence / total).toFixed(2))
      },
      persistenceDistribution: [
        { range: '1-5 days', count: persistenceBins['1-5d'], label: 'Brief / Transient' },
        { range: '6-15 days', count: persistenceBins['6-15d'], label: 'Medium Duration' },
        { range: '16-30 days', count: persistenceBins['16-30d'], label: 'Extended Duration' },
        { range: '31-60 days', count: persistenceBins['31-60d'], label: 'Industrial Flares' },
        { range: '60+ days', count: persistenceBins['60+d'], label: 'Permanent Kilns' }
      ],
      frpDistribution: [
        { range: '0-5 MW', count: frpBins['0-5 MW'], label: 'Low Radiative' },
        { range: '5-15 MW', count: frpBins['5-15 MW'], label: 'Moderate' },
        { range: '15-30 MW', count: frpBins['15-30 MW'], label: 'Substantial' },
        { range: '30-50 MW', count: frpBins['30-50 MW'], label: 'High Intensity' },
        { range: '50+ MW', count: frpBins['50+ MW'], label: 'Extreme Anomaly' }
      ],
      detectionDistribution: [
        { range: '1-5 scans', count: detectionBins['1-5'] },
        { range: '6-20 scans', count: detectionBins['6-20'] },
        { range: '21-50 scans', count: detectionBins['21-50'] },
        { range: '51-100 scans', count: detectionBins['51-100'] },
        { range: '100+ scans', count: detectionBins['100+'] }
      ],
      classComparison,
      frp: {
        minAvgFrp: Number(minFrp.toFixed(2)),
        maxFrp: Number(maxFrp.toFixed(2)),
        avgFrp: Number((sumAvgFrp / total).toFixed(2)),
        totalFrpSum: Number(sumTotalFrp.toFixed(2))
      },
      brightnessTemperatureKelvin: {
        avgBrightTi4: Number((sumTi4 / total).toFixed(2)),
        avgBrightTi5: Number((sumTi5 / total).toFixed(2))
      },
      averageDistancesKm: {
        industrialArea: Number((sumDistIndustrial / total).toFixed(2)),
        powerPlant: Number((sumDistPower / total).toFixed(2)),
        quarry: Number((sumDistQuarry / total).toFixed(2)),
        substation: Number((sumDistSubstation / total).toFixed(2)),
        storageTank: Number((sumDistStorage / total).toFixed(2)),
        works: Number((sumDistWorks / total).toFixed(2))
      },
      dataIntegrityNotice: 'Aggregations computed from 100% authoritative observations in data/fire_dataset.csv.xls.'
    };
  }

  getEvents(filters = {}, pagination = { page: 1, limit: 50 }) {
    let result = this.events;

    const {
      classification,
      search,
      minConfidence,
      maxConfidence,
      minPersistence,
      maxPersistence
    } = filters;

    const hasFilters = classification || 
      search ||
      minConfidence !== undefined || 
      maxConfidence !== undefined || 
      minPersistence !== undefined || 
      maxPersistence !== undefined;

    if (hasFilters) {
      const clsLower = classification ? classification.toLowerCase() : null;
      const searchClean = search ? String(search).replace('#', '').trim().toLowerCase() : null;
      const searchId = searchClean && !isNaN(Number(searchClean)) ? Number(searchClean) : null;
      const minConf = minConfidence !== undefined ? Number(minConfidence) : null;
      const maxConf = maxConfidence !== undefined ? Number(maxConfidence) : null;
      const minPers = minPersistence !== undefined ? Number(minPersistence) : null;
      const maxPers = maxPersistence !== undefined ? Number(maxPersistence) : null;

      result = result.filter((e) => {
        if (searchClean) {
          if (searchId !== null && e.id === searchId) {
            // exact ID match
          } else {
            const matchFireType = e.fire_type.toLowerCase().includes(searchClean);
            const matchPredClass = e.prediction_class.toLowerCase().includes(searchClean);
            if (!matchFireType && !matchPredClass) return false;
          }
        }

        if (clsLower) {
          const matchFireType = e.fire_type.toLowerCase().includes(clsLower);
          const matchPredClass = e.prediction_class.toLowerCase() === clsLower;
          if (!matchFireType && !matchPredClass) return false;
        }

        if (minConf !== null && !isNaN(minConf) && e.prediction_confidence < minConf) {
          return false;
        }
        if (maxConf !== null && !isNaN(maxConf) && e.prediction_confidence > maxConf) {
          return false;
        }
        if (minPers !== null && !isNaN(minPers) && e.persistence_days < minPers) {
          return false;
        }
        if (maxPers !== null && !isNaN(maxPers) && e.persistence_days > maxPers) {
          return false;
        }

        return true;
      });
    }

    const total = result.length;
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(pagination.limit) || 50));
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = result.slice(startIndex, startIndex + limit).map((e) => e.toJSON());

    return {
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      filters: {
        classification: classification || null,
        minConfidence: minConfidence !== undefined ? Number(minConfidence) : null,
        maxConfidence: maxConfidence !== undefined ? Number(maxConfidence) : null,
        minPersistence: minPersistence !== undefined ? Number(minPersistence) : null,
        maxPersistence: maxPersistence !== undefined ? Number(maxPersistence) : null
      },
      data: items
    };
  }

  getEventById(id) {
    const numId = Number(id);
    return this.eventsById.get(numId) || null;
  }

  getEventStats() {
    return this.precomputedStats;
  }

  getInfrastructure(filters = {}, pagination = { page: 1, limit: 50 }) {
    let result = this.infrastructure;
    const { category } = filters;

    if (category) {
      const catLower = category.toLowerCase().trim();
      result = result.filter((inf) => inf.feature_category.toLowerCase() === catLower);
    }

    const total = result.length;
    const page = Math.max(1, Number(pagination.page) || 1);
    const limit = Math.min(2000, Math.max(1, Number(pagination.limit) || 50));
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = result.slice(startIndex, startIndex + limit);

    return {
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      filters: {
        category: category || null
      },
      availableCategories: Array.from(this.infrastructureCategories),
      data: items
    };
  }

  getStatus() {
    return {
      isLoaded: this.isLoaded,
      eventsCount: this.events.length,
      infrastructureCount: this.infrastructure.length,
      mode: 'csv_repository',
      files: {
        events: this.eventsPath,
        infrastructure: this.infraPath
      }
    };
  }
}

// Singleton instance
const csvRepository = new CsvRepository();

module.exports = csvRepository;
