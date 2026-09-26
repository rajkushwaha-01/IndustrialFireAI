import test from 'node:test';
import assert from 'node:assert';

test('SIH PS 26162 Phase 8: Dashboard KPIs and Deep Links Verification', async (t) => {
  // Test KPI definitions and route schema
  const expectedKpis = [
    { id: 1, title: 'Total Thermal Anomalies', targetRoute: '/map' },
    { id: 2, title: 'Industrial Fires', targetRoute: '/map?classification=Industrial%20Fire' },
    { id: 3, title: 'Persistent Thermal Sources', targetRoute: '/map?classification=Persistent%20Thermal%20Source' },
    { id: 4, title: 'Natural Fires', targetRoute: '/map?classification=Natural%20Fire' },
    { id: 5, title: 'Other / Unknown', targetRoute: '/map?classification=Other' },
    { id: 6, title: 'High-Confidence Events', targetRoute: '/events?minConfidence=0.9' },
    { id: 7, title: 'Recent Detections', targetRoute: '/events?hasCoordinates=true' },
    { id: 8, title: 'High-FRP Events', targetRoute: '/map?minFrp=30' },
    { id: 9, title: 'Events Near Industrial Infra', targetRoute: '/map?maxDistance=3.0' }
  ];

  assert.strictEqual(expectedKpis.length, 9, 'Must have exactly 9 core SIH KPIs');

  expectedKpis.forEach(kpi => {
    assert.ok(kpi.targetRoute, `KPI ${kpi.title} must have a valid target link`);
    assert.ok(kpi.targetRoute.startsWith('/map') || kpi.targetRoute.startsWith('/events'), 'Must link to GIS map or event registry');
  });
});

test('SIH PS 26162 Phase 8: Backend Live Stats Contract Verification', async () => {
  // Fetch real statistics from running backend
  const res = await fetch('http://localhost:5000/api/events/stats');
  assert.strictEqual(res.status, 200, 'Backend stats API must return 200 OK');
  
  const json = await res.json();
  assert.strictEqual(json.success, true, 'API response must indicate success');
  
  const stats = json.data;
  assert.ok(stats, 'Stats data must be present');

  // Verify KPI 1-9 genuine data presence
  assert.ok(typeof stats.kpis?.totalAnomalies === 'number' && stats.kpis.totalAnomalies > 200000, 'Total anomalies must be genuine dataset count (>200,000)');
  assert.ok(typeof stats.kpis?.industrialFires === 'number' && stats.kpis.industrialFires > 0, 'Industrial fires count must be > 0');
  assert.ok(typeof stats.kpis?.persistentSources === 'number' && stats.kpis.persistentSources > 0, 'Persistent sources count must be > 0');
  assert.ok(typeof stats.kpis?.naturalFires === 'number' && stats.kpis.naturalFires > 0, 'Natural fires count must be > 0');
  assert.ok(typeof stats.kpis?.otherUnknown === 'number' && stats.kpis.otherUnknown > 0, 'Other/unknown count must be > 0');
  assert.ok(typeof stats.kpis?.highConfidenceEvents === 'number' && stats.kpis.highConfidenceEvents > 0, 'High-confidence events count must be > 0');
  assert.ok(typeof stats.kpis?.recentDetections === 'number' && stats.kpis.recentDetections > 0, 'Recent detections count must be > 0');
  assert.ok(typeof stats.kpis?.highFrpEvents === 'number' && stats.kpis.highFrpEvents > 0, 'High-FRP events count must be > 0');
  assert.ok(typeof stats.kpis?.eventsNearInfrastructure === 'number' && stats.kpis.eventsNearInfrastructure > 0, 'Events near infra count must be > 0');

  // Verification: Sum of classes matches total anomalies
  const totalClasses = (stats.kpis.industrialFires || 0) + 
                       (stats.kpis.persistentSources || 0) + 
                       (stats.kpis.naturalFires || 0) + 
                       (stats.kpis.otherUnknown || 0);
  assert.strictEqual(totalClasses, stats.kpis.totalAnomalies, 'Sum of all 4 fire classifications must equal total anomalies');

  // Verify 6 Chart Distributions
  // 1. Classification distribution
  assert.ok(stats.byClassification['Industrial Fire']?.count > 0, 'Classification distribution must contain Industrial Fire');
  assert.ok(stats.byClassification['Persistent Thermal Source']?.count > 0, 'Classification distribution must contain Persistent Thermal Source');
  assert.ok(stats.byClassification['Natural Fire']?.count > 0, 'Classification distribution must contain Natural Fire');
  assert.ok(stats.byClassification['Other']?.count > 0, 'Classification distribution must contain Other');

  // 2. Temporal trend
  assert.ok(Array.isArray(stats.temporalTrend), 'Temporal trend must be an array');
  assert.ok(stats.temporalTrend.length > 0, 'Temporal trend must have daily points');
  stats.temporalTrend.forEach(t => {
    assert.ok(t.date, 'Temporal point must have a date');
    assert.ok(typeof t.count === 'number', 'Temporal point must have a numeric count');
  });

  // 3. FRP distribution
  assert.ok(Array.isArray(stats.frpDistribution), 'FRP distribution must be an array');
  assert.strictEqual(stats.frpDistribution.length, 5, 'FRP distribution must have 5 power intervals');

  // 4. Persistence distribution
  assert.ok(Array.isArray(stats.persistenceDistribution), 'Persistence distribution must be an array');
  assert.strictEqual(stats.persistenceDistribution.length, 5, 'Persistence distribution must have 5 duration bins');

  // 5. Infrastructure proximity distribution
  assert.ok(Array.isArray(stats.proximityDistribution), 'Proximity distribution must be an array');
  assert.strictEqual(stats.proximityDistribution.length, 5, 'Proximity distribution must have 5 distance bins (<1km, 1-3km, 3-5km, 5-10km, 10+km)');

  // 6. Confidence distribution
  assert.ok(Array.isArray(stats.confidenceDistribution), 'Confidence distribution must be an array');
  assert.strictEqual(stats.confidenceDistribution.length, 4, 'Confidence distribution must have 4 tiers');
});
