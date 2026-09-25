const express = require('express');
const healthRoutes = require('./health');
const eventRoutes = require('./events');
const infrastructureRoutes = require('./infrastructure');
const mlRoutes = require('./ml');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/events', eventRoutes);
router.use('/infrastructure', infrastructureRoutes);
router.use('/', mlRoutes);

module.exports = router;
