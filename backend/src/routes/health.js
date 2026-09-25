const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

router.get('/health', (req, res, next) => healthController.getHealth(req, res, next));

module.exports = router;
