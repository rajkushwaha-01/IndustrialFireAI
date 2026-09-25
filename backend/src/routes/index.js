const express = require('express');
const healthRoutes = require('./health');
const eventRoutes = require('./events');
const infrastructureRoutes = require('./infrastructure');
const spatialRoutes = require('./spatial');
const mlRoutes = require('./ml');
const firmsRoutes = require('./firms');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/events', eventRoutes);
router.use('/infrastructure', infrastructureRoutes);
router.use('/spatial', spatialRoutes);
router.use('/firms', firmsRoutes);
router.use('/', mlRoutes);

module.exports = router;
