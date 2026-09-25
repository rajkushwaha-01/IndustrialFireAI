const express = require('express');
const infrastructureController = require('../controllers/infrastructureController');

const router = express.Router();

router.get('/', (req, res, next) => infrastructureController.getInfrastructure(req, res, next));

module.exports = router;
