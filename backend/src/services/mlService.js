const axios = require('axios');
const config = require('../config');
const { AppError, ValidationError } = require('../utils/errors');

class MlService {
  constructor() {
    this.client = axios.create({
      baseURL: config.mlServiceUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async getHealth() {
    try {
      const response = await this.client.get('/health');
      return {
        reachable: true,
        status: response.data.status,
        details: response.data
      };
    } catch (error) {
      return {
        reachable: false,
        error: error.message
      };
    }
  }

  async getModelInfo() {
    try {
      const response = await this.client.get('/model-info');
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(`ML service request timed out after 10000ms at ${config.mlServiceUrl}`, 504);
      }
      if (error.response) {
        throw new AppError(
          error.response.data?.detail || 'Failed to retrieve model info from ML service',
          error.response.status
        );
      }
      throw new AppError(`ML service unreachable at ${config.mlServiceUrl}: ${error.message}`, 503);
    }
  }

  async predict(features) {
    if (!features || typeof features !== 'object') {
      throw new ValidationError('Prediction request body must be a JSON object with 14 features');
    }

    try {
      const response = await this.client.post('/predict', features);
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(`ML inference request timed out after 10000ms at ${config.mlServiceUrl}`, 504);
      }
      if (error.response) {
        // Forward validation or ML error
        const status = error.response.status;
        const detail = error.response.data?.detail || 'Inference error';
        if (status === 422) {
          throw new ValidationError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
        throw new AppError(typeof detail === 'string' ? detail : JSON.stringify(detail), status);
      }
      throw new AppError(`ML service unreachable at ${config.mlServiceUrl}: ${error.message}`, 503);
    }
  }
}

module.exports = new MlService();
