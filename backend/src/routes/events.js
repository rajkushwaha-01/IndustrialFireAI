const express = require('express');
const eventController = require('../controllers/eventController');

const router = express.Router();

// Specific routes must precede :id to prevent matching them as an ID parameter
router.get('/stats', (req, res, next) => eventController.getStats(req, res, next));
router.get('/geojson', (req, res, next) => eventController.getGeoJSON(req, res, next));
router.get('/spatial-correlation', (req, res, next) => eventController.getSpatialCorrelation(req, res, next));
router.get('/nearby-infrastructure', (req, res, next) => eventController.getNearbyInfrastructure(req, res, next));
router.get('/', (req, res, next) => eventController.getEvents(req, res, next));
router.get('/:id', (req, res, next) => eventController.getEventById(req, res, next));

module.exports = router;
