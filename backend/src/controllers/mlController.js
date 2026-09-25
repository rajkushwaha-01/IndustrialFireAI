const mlService = require('../services/mlService');

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
      res.status(200).json(prediction);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MlController();
