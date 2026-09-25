#!/usr/bin/env node

/**
 * CLI Tool: NASA FIRMS Full Ingestion Pipeline
 * Usage:
 *   node backend/src/scripts/importFirms.js [options]
 *
 * Options:
 *   --file <path>        Path to NASA FIRMS active fire CSV file
 *   --api                Fetch genuine active fire data from live NASA FIRMS REST API
 *   --country <IND>      Country ISO-3 code for API fetch (default: IND)
 *   --days <1..10>       Acquisition day range for API fetch (default: 1)
 *   --source <satellite> Satellite source (default: VIIRS_NOAA20_NRT)
 *   --max <limit>        Maximum records to process
 *   --no-spatial         Skip spatial correlation step
 *   --no-ml              Skip ML inference step
 */

const path = require('path');
const fs = require('fs');
const dataRepository = require('../repositories');
const firmsIngestionService = require('../services/firmsIngestionService');

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
NASA FIRMS Data Ingestion Pipeline CLI — Phase 5
Problem Statement 26162 (NTRO)

Conceptual Pipeline:
  FIRMS source -> Fetch -> Validate -> Normalize -> Deduplicate -> Store -> Spatial Correlation -> ML Inference -> GIS API

Usage:
  node backend/src/scripts/importFirms.js [options]

Options:
  --file <path>       Ingest from local FIRMS CSV file (default: data/firms_canonical_events.csv)
  --api               Fetch live NASA FIRMS active fire data via REST API
  --country <code>    Country code for API fetch (default: IND)
  --days <number>     Day range for API fetch [1-10] (default: 1)
  --source <sensor>   Satellite sensor for API [VIIRS_NOAA20_NRT, VIIRS_SNPP_NRT, MODIS_NRT]
  --max <number>      Maximum records to ingest
  --no-spatial        Disable automated spatial correlation
  --no-ml             Disable automated ML classification inference

Examples:
  node backend/src/scripts/importFirms.js --file ./data/firms_canonical_events.csv
  node backend/src/scripts/importFirms.js --api --country IND --days 2
`);
    process.exit(0);
  }

  // Parse CLI flags
  let sourceMode = 'file';
  let filePath = null;
  let country = 'IND';
  let dayRange = 1;
  let sourceSatellite = 'VIIRS_NOAA20_NRT';
  let maxRows = Infinity;
  let runSpatial = true;
  let runMl = true;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api') {
      sourceMode = 'api';
    } else if (args[i] === '--file' && args[i + 1]) {
      sourceMode = 'file';
      filePath = path.resolve(process.cwd(), args[++i]);
    } else if (args[i] === '--country' && args[i + 1]) {
      country = args[++i].toUpperCase();
    } else if (args[i] === '--days' && args[i + 1]) {
      dayRange = Math.min(10, Math.max(1, parseInt(args[++i], 10) || 1));
    } else if (args[i] === '--source' && args[i + 1]) {
      sourceSatellite = args[++i];
    } else if (args[i] === '--max' && args[i + 1]) {
      maxRows = parseInt(args[++i], 10) || Infinity;
    } else if (args[i] === '--no-spatial') {
      runSpatial = false;
    } else if (args[i] === '--no-ml') {
      runMl = false;
    } else if (!args[i].startsWith('--') && !filePath) {
      filePath = path.resolve(process.cwd(), args[i]);
    }
  }

  console.log(`[FIRMS Pipeline] Initializing data layer repository...`);
  await dataRepository.init();

  console.log(`[FIRMS Pipeline] Executing ingestion pipeline:`);
  console.log(`  - Mode:                  ${sourceMode.toUpperCase()}`);
  if (sourceMode === 'file') {
    const targetFile = filePath || path.resolve(process.cwd(), 'data/firms_canonical_events.csv');
    console.log(`  - File Target:           ${targetFile}`);
  } else {
    console.log(`  - NASA API Country:      ${country}`);
    console.log(`  - Day Range:             ${dayRange} days`);
    console.log(`  - Satellite Sensor:      ${sourceSatellite}`);
  }
  console.log(`  - Spatial Correlation:   ${runSpatial ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  - ML Inference:          ${runMl ? 'ENABLED' : 'DISABLED'}\n`);

  try {
    const stats = await firmsIngestionService.executePipeline({
      source: sourceMode,
      filePath,
      country,
      dayRange,
      sourceSatellite,
      maxRows,
      runSpatialCorrelation: runSpatial,
      runMlInference: runMl
    });

    console.log(`=======================================================`);
    console.log(`          FIRMS INGESTION PIPELINE SUMMARY            `);
    console.log(`=======================================================`);
    console.log(JSON.stringify(stats, null, 2));
    console.log(`=======================================================`);
    console.log(`✓ Data available immediately in GIS API (/api/events/geojson)`);
    process.exit(0);
  } catch (err) {
    console.error(`\n[FATAL PIPELINE ERROR] ${err.message}`);
    process.exit(1);
  }
}

main();
