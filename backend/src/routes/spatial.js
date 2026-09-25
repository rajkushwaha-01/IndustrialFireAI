const express = require('express');
const eventController = require('../controllers/eventController');

const router = express.Router();

// Geospatial correlation endpoints
router.get('/correlate', (req, res, next) => eventController.getSpatialCorrelation(req, res, next));
router.get('/nearby', (req, res, next) => eventController.getNearbyInfrastructure(req, res, next));

module.exports = router;
