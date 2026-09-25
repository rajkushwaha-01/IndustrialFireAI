const infrastructureService = require('../services/infrastructureService');

class InfrastructureController {
  async getInfrastructure(req, res, next) {
    try {
      const result = await infrastructureService.getInfrastructure(req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InfrastructureController();
