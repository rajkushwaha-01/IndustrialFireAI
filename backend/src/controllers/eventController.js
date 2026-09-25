const eventService = require('../services/eventService');

class EventController {
  async getEvents(req, res, next) {
    try {
      const result = await eventService.getEvents(req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getEventById(req, res, next) {
    try {
      const { id } = req.params;
      const event = await eventService.getEventById(id);
      res.status(200).json({
        success: true,
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await eventService.getStats();
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  async getGeoJSON(req, res, next) {
    try {
      const geojson = await eventService.getGeoJSON();
      res.status(200).json(geojson);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new EventController();
