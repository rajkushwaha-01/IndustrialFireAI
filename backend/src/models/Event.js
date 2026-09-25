/**
 * Event Model Schema & Formatter
 */
class Event {
  constructor(data) {
    this.id = Number(data.id);
    this.persistence_days = Number(data.persistence_days);
    this.detections = Number(data.detections);
    this.avg_frp = Number(data.avg_frp);
    this.max_frp = Number(data.max_frp);
    this.total_frp = Number(data.total_frp);
    this.avg_bright_ti4 = Number(data.avg_bright_ti4);
    this.avg_bright_ti5 = Number(data.avg_bright_ti5);
    this.night_ratio = Number(data.night_ratio);
    this.distance_to_industrial_area_km = Number(data.distance_to_industrial_area_km);
    this.distance_to_power_plant_km = Number(data.distance_to_power_plant_km);
    this.distance_to_quarry_km = Number(data.distance_to_quarry_km);
    this.distance_to_substation_km = Number(data.distance_to_substation_km);
    this.distance_to_storage_tank_km = Number(data.distance_to_storage_tank_km);
    this.distance_to_works_km = Number(data.distance_to_works_km);
    this.prediction_class = String(data.prediction_class || '').trim();
    this.prediction_confidence = Number(data.prediction_confidence);
    this.fire_type = String(data.fire_type || '').trim();
  }

  toJSON() {
    return {
      id: this.id,
      persistence_days: this.persistence_days,
      detections: this.detections,
      avg_frp: this.avg_frp,
      max_frp: this.max_frp,
      total_frp: this.total_frp,
      avg_bright_ti4: this.avg_bright_ti4,
      avg_bright_ti5: this.avg_bright_ti5,
      night_ratio: this.night_ratio,
      distance_to_industrial_area_km: this.distance_to_industrial_area_km,
      distance_to_power_plant_km: this.distance_to_power_plant_km,
      distance_to_quarry_km: this.distance_to_quarry_km,
      distance_to_substation_km: this.distance_to_substation_km,
      distance_to_storage_tank_km: this.distance_to_storage_tank_km,
      distance_to_works_km: this.distance_to_works_km,
      prediction_class: this.prediction_class,
      prediction_confidence: this.prediction_confidence,
      fire_type: this.fire_type
    };
  }
}

module.exports = Event;
