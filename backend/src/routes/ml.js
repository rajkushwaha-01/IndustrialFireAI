const express = require('express');
const mlController = require('../controllers/mlController');

const router = express.Router();

router.get('/model-info', (req, res, next) => mlController.getModelInfo(req, res, next));
router.post('/predict', (req, res, next) => mlController.predict(req, res, next));

module.exports = router;
