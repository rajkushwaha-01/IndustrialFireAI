const express = require('express');
const firmsIngestionService = require('../services/firmsIngestionService');

const router = express.Router();

/**
 * POST /api/firms/ingest
 * Admin/Developer manual ingestion pipeline trigger.
 * Accepts: { source: 'file'|'api'|'csv_content', filePath, csvContent, country, dayRange, maxRows, runSpatialCorrelation, runMlInference }
 */
router.post('/ingest', async (req, res, next) => {
  try {
    const stats = await firmsIngestionService.executePipeline(req.body);
    res.status(200).json({
      success: true,
      message: 'FIRMS ingestion pipeline executed successfully',
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/firms/status
 * Ingestion pipeline configuration and recent batch execution statistics.
 * Secure: Never exposes secret API keys.
 */
router.get('/status', (req, res) => {
  const status = firmsIngestionService.getStatus();
  res.status(200).json({
    success: true,
    data: status
  });
});

/**
 * GET /api/firms/rejections
 * Audit log of invalid records rejected during last batch execution.
 */
router.get('/rejections', (req, res) => {
  res.status(200).json({
    success: true,
    count: firmsIngestionService.rejectionLog.length,
    data: firmsIngestionService.rejectionLog
  });
});

/**
 * POST /api/firms/sync
 * Quick trigger to execute live NASA FIRMS REST API sync.
 */
router.post('/sync', async (req, res, next) => {
  try {
    const stats = await firmsIngestionService.executePipeline({
      source: 'api',
      dayRange: req.body?.dayRange || 1,
      country: req.body?.country || 'IND'
    });
    res.status(200).json({
      success: true,
      message: 'Live NASA FIRMS API synchronization completed',
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
