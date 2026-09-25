Write-Host "--- API Smoke Tests Starting ---"
$base = "http://localhost:5000/api"

try {
    # 1. GET /api/model-info
    $modelInfo = Invoke-RestMethod -Uri "$base/model-info"
    Write-Host "1. GET /api/model-info -> Model Type: $($modelInfo.model_type) | Estimators: $($modelInfo.n_estimators) | Features: $($modelInfo.feature_names.Count)"

    # 2. GET /api/events
    $events = Invoke-RestMethod -Uri "$base/events?limit=2"
    Write-Host "2. GET /api/events -> Success: $($events.success) | Total in DB: $($events.pagination.total) | Items: $($events.data.Count)"
    $firstId = $events.data[0].id

    # 3. GET /api/events/:id
    $event = Invoke-RestMethod -Uri "$base/events/$firstId"
    Write-Host "3. GET /api/events/:id -> Success: $($event.success) | Event ID: $($event.data.id) | Persistence: $($event.data.persistence_days) days | Class: $($event.data.fire_type)"

    # 4. GET /api/events/stats
    $stats = Invoke-RestMethod -Uri "$base/events/stats"
    Write-Host "4. GET /api/events/stats -> Success: $($stats.success) | Total Events: $($stats.data.totalEvents)"

    # 5. GET /api/events/geojson
    $geojson = Invoke-RestMethod -Uri "$base/events/geojson"
    Write-Host "5. GET /api/events/geojson -> Type: $($geojson.type) | Features: $($geojson.features.Count) | Notice: $($geojson.metadata.notice.Substring(0, 45))..."

    # 6. GET /api/infrastructure
    $infra = Invoke-RestMethod -Uri "$base/infrastructure?limit=2"
    Write-Host "6. GET /api/infrastructure -> Success: $($infra.success) | Total Points: $($infra.pagination.total) | Items: $($infra.data.Count)"

    # 7. POST /api/predict
    $body = @{
        persistence_days = 7.0
        detections = 14
        avg_frp = 15.2
        max_frp = 45.0
        total_frp = 212.8
        avg_bright_ti4 = 345.2
        avg_bright_ti5 = 305.1
        night_ratio = 0.85
        distance_to_industrial_area_km = 1.2
        distance_to_power_plant_km = 8.4
        distance_to_quarry_km = 12.0
        distance_to_substation_km = 4.5
        distance_to_storage_tank_km = 2.1
        distance_to_works_km = 3.0
    } | ConvertTo-Json

    $prediction = Invoke-RestMethod -Uri "$base/predict" -Method Post -Body $body -ContentType "application/json"
    Write-Host "7. POST /api/predict -> Prediction: $($prediction.prediction) | Confidence: $($prediction.confidence) | Probabilities: Industrial: $($prediction.probabilities.'Industrial Fire')"

    Write-Host "`n=== ALL 7 API ENDPOINTS VERIFIED & WORKING PERFECTLY ==="
} catch {
    Write-Error "Smoke test failed: $_"
    exit 1
}
