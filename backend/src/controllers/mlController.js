const mlService = require('../services/mlService');
const classificationEvidenceService = require('../services/classificationEvidenceService');

class MlController {
  async getModelInfo(req, res, next) {
    try {
      const modelInfo = await mlService.getModelInfo();
      res.status(200).json(modelInfo);
    } catch (error) {
      next(error);
    }
  }

  async predict(req, res, next) {
    try {
      const prediction = await mlService.predict(req.body);
      
      // Ensure evidence layer is always attached
      if (!prediction.evidence) {
        prediction.evidence = classificationEvidenceService.evaluateEvidence(req.body, prediction);
      }

      res.status(200).json(prediction);
    } catch (error) {
      next(error);
    }
  }

  async evaluateEvidence(req, res, next) {
    try {
      const evidence = classificationEvidenceService.evaluateEvidence(req.body);
      res.status(200).json(evidence);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MlController();
