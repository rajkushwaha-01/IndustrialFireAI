const express = require('express');
const eventController = require('../controllers/eventController');

const router = express.Router();

// Stats and GeoJSON must precede :id to prevent matching 'stats' or 'geojson' as an ID
router.get('/stats', (req, res, next) => eventController.getStats(req, res, next));
router.get('/geojson', (req, res, next) => eventController.getGeoJSON(req, res, next));
router.get('/', (req, res, next) => eventController.getEvents(req, res, next));
router.get('/:id', (req, res, next) => eventController.getEventById(req, res, next));

module.exports = router;
