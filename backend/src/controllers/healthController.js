const config = require('../config');
const mlService = require('../services/mlService');
const dataRepository = require('../repositories');

class HealthController {
  async getHealth(req, res, next) {
    try {
      const mlStatus = await mlService.getHealth();
      const repoStatus = dataRepository.getStatus();

      res.status(200).json({
        status: 'healthy',
        service: 'industrial-fire-backend',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: config.nodeEnv,
        dataLayer: {
          mode: repoStatus.mode,
          isLoaded: repoStatus.isLoaded,
          eventsCount: repoStatus.eventsCount,
          infrastructureCount: repoStatus.infrastructureCount
        },
        services: {
          mlService: mlStatus
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HealthController();
