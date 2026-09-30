import React from 'react';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import StatusBadge from '../components/StatusBadge';
import {
  Satellite,
  Flame,
  Cpu,
  Layers,
  MapPin,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Database,
  ArrowDown,
  Building2,
  Clock,
  Crosshair
} from 'lucide-react';

export default function DataSources() {
  // Visual Pipeline Steps
  const pipelineSteps = [
    {
      step: '01',
      title: 'NASA FIRMS Satellite Observation',
      subtitle: 'Spaceborne Thermal Radiometry',
      icon: Satellite,
      badge: 'Data Acquisition',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      description:
        'NASA Fire Information for Resource Management System (FIRMS) utilizes VIIRS (Visible Infrared Imaging Radiometer Suite) on Suomi NPP/NOAA-20 and MODIS on Terra/Aqua to capture mid-infrared (3.75μm–4.0μm) thermal anomalies across the earth surface at 375m spatial resolution.',
      attribution: 'NASA EOSDIS FIRMS',
      link: 'https://firms.modaps.eosdis.nasa.gov/'
    },
    {
      step: '02',
      title: 'Thermal Anomaly Detection',
      subtitle: 'Sub-Pixel Hotspot Identification',
      icon: Flame,
      badge: 'Detection Processing',
      badgeColor: 'bg-flame-50 text-flame-700 border-flame-200',
      description:
        'Raw sensor channels evaluate brightness temperatures (TI-4 mid-wave IR, TI-5 long-wave IR) and Fire Radiative Power (FRP) against background contextual thresholds. This step identifies active thermal anomalies but CANNOT distinguish between industrial fires, flare stacks, or forest burns.',
      attribution: 'VIIRS Active Fire Algorithm',
      link: 'https://earthdata.nasa.gov/learn/find-data/near-real-time/firms/viirs-i-band-375-m-active-fire-data'
    },
    {
      step: '03',
      title: 'Feature Engineering & Multi-Temporal Aggregation',
      subtitle: 'Persistence & Radiative Signatures',
      icon: Clock,
      badge: 'Signal Extraction',
      badgeColor: 'bg-persistent-50 text-persistent-700 border-persistent-200',
      description:
        'Successive satellite passes over identical coordinates are clustered across time. Multi-day temporal persistence (persistence_days), cumulative detection scans, average/peak FRP, and night-to-day observation ratios are computed to isolate recurrent emitters from ephemeral vegetation burns.',
      attribution: 'Thermal Clustering Pipeline',
      link: null
    },
    {
      step: '04',
      title: 'Infrastructure & OpenStreetMap Context',
      subtitle: 'Geospatial Proximity Extraction',
      icon: Building2,
      badge: 'Spatial Intelligence',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      description:
        'Thermal clusters are cross-referenced with 139,682 verified OpenStreetMap infrastructure coordinates across India. Spatial Euclidean distances (km) are calculated to the nearest industrial areas, power plants, quarries, electrical substations, storage tanks, and industrial works.',
      attribution: 'OpenStreetMap Contributors',
      link: 'https://www.openstreetmap.org/'
    },
    {
      step: '05',
      title: 'Random Forest Classification',
      subtitle: '200-Estimator Machine Learning Inference',
      icon: Cpu,
      badge: 'ML Classification',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      description:
        'The pre-trained RandomForestClassifier evaluates the 14-dimensional feature vector. By synthesizing temporal persistence with infrastructure proximity, the model classifies each anomaly into Industrial Fire, Persistent Thermal Source, Natural Fire, or Other with calibrated probability scores.',
      attribution: 'scikit-learn RandomForestClassifier',
      link: 'https://scikit-learn.org/stable/modules/ensemble.html#forests-of-randomized-trees'
    },
    {
      step: '06',
      title: 'GIS Geospatial Surveillance',
      subtitle: 'Interactive Map Interface',
      icon: MapPin,
      badge: 'Spatial Interface',
      badgeColor: 'bg-geo-50 text-geo-700 border-geo-200',
      description:
        'Classified events are projected onto Leaflet GIS layers alongside infrastructure anchors, confidence rings, and proximity buffers for spatial inspection.',
      attribution: 'Leaflet & GeoJSON',
      link: 'https://leafletjs.com/'
    },
    {
      step: '07',
      title: 'Monitoring & Analytics',
      subtitle: 'Alerts & Assessment',
      icon: BarChart3,
      badge: 'Analytics & Alerts',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      description:
        'High-confidence detections generate alerts and emission tracking. Statistical metrics monitor recurrence cycles, industrial clusters, and baseline distributions.',
      attribution: 'ThermalWatch Analytics Suite',
      link: null
    }
  ];

  // Model Features Breakdown
  const featureGroups = [
    {
      group: 'Temporal & Recurrence Features',
      description: 'Quantifies event lifetime and observational frequency to differentiate continuous industrial operations from transient wildland fires.',
      features: [
        {
          name: 'persistence_days',
          unit: 'Days (1 - 179)',
          type: 'float64',
          description: 'Total elapsed days between the initial satellite detection and the most recent detection at this cluster location. Industrial flares and kilns persist for weeks/months; natural fires extinguish in 1-5 days.'
        },
        {
          name: 'detections',
          unit: 'Scans count',
          type: 'int64',
          description: 'Total number of satellite overpass detections registering the thermal anomaly. High detection counts indicate stationary, recurrent thermal emitters.'
        },
        {
          name: 'night_ratio',
          unit: 'Percentage (0 - 100%)',
          type: 'float64',
          description: 'Proportion of detections occurring during nighttime satellite passes. Industrial manufacturing (furnaces, flares) operates 24/7, yielding distinct nighttime thermal signatures.'
        }
      ]
    },
    {
      group: 'Thermal & Radiative Energy Features',
      description: 'Physical radiometry metrics derived from VIIRS mid-wave (I-4) and long-wave (I-5) infrared bands.',
      features: [
        {
          name: 'avg_frp',
          unit: 'Megawatts (MW)',
          type: 'float64',
          description: 'Mean Fire Radiative Power across all detection passes. Measures instantaneous thermal radiation energy output released by the combustion process.'
        },
        {
          name: 'max_frp',
          unit: 'Megawatts (MW)',
          type: 'float64',
          description: 'Peak radiative power observed across any single satellite overpass. Helps identify acute explosion events, high-intensity flare surges, or severe blaze peaks.'
        },
        {
          name: 'total_frp',
          unit: 'Megawatts (MW)',
          type: 'float64',
          description: 'Cumulative sum of radiative energy discharged across the entire event lifetime.'
        },
        {
          name: 'avg_bright_ti4',
          unit: 'Kelvin (K)',
          type: 'float64',
          description: 'Average brightness temperature from VIIRS Channel I-4 (3.74 - 3.96 μm). Optimized for sub-pixel high-temperature combustion hotspot detection.'
        },
        {
          name: 'avg_bright_ti5',
          unit: 'Kelvin (K)',
          type: 'float64',
          description: 'Average brightness temperature from VIIRS Channel I-5 (10.5 - 12.4 μm). Measures thermal background, surface temperature, and smoke/cloud obscuration.'
        }
      ]
    },
    {
      group: 'Geospatial & Infrastructure Proximity Features',
      description: 'Shortest Euclidean distance (in kilometers) from the thermal cluster to the nearest registered OpenStreetMap infrastructure facility.',
      features: [
        {
          name: 'distance_to_industrial_area_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to designated industrial zones, manufacturing parks, and Special Economic Zones (SEZs). Industrial fires cluster within < 5 km.'
        },
        {
          name: 'distance_to_power_plant_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to thermal power plants, nuclear facilities, gas-fired turbines, or hydroelectric complexes.'
        },
        {
          name: 'distance_to_quarry_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to stone quarries, open-cast mines, and mineral extraction sites where controlled blasting or machinery produces thermal signatures.'
        },
        {
          name: 'distance_to_substation_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to electrical transmission substations, transformer yards, and high-voltage grid infrastructure.'
        },
        {
          name: 'distance_to_storage_tank_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to petroleum refineries, chemical storage tank farms, liquefied natural gas (LNG) terminals, and fuel depots.'
        },
        {
          name: 'distance_to_works_km',
          unit: 'Kilometers (km)',
          type: 'float64',
          description: 'Distance to heavy engineering works, iron & steel foundries, smelters, cement manufacturing plants, and chemical processing facilities.'
        }
      ]
    }
  ];

  // 4 Target Classes
  const targetClasses = [
    {
      name: 'Industrial Fire',
      badge: 'Critical Hazard',
      style: 'border-flame-200 bg-flame-50/50 text-flame-900',
      badgeStyle: 'bg-flame-100 text-flame-800 border-flame-300',
      dotColor: 'bg-flame-500',
      count: '2,405 Events (1.07%)',
      description:
        'Unplanned or acute combustion events occurring within or directly adjacent to industrial establishments. Characterized by high thermal persistence (mean: 7.27 days), elevated peak radiative power, and close proximity to industrial zones (mean: 4.80 km).',
      examples:
        'Petrochemical refinery fires, chemical warehouse blazes, pipeline leaks, unplanned flare stack surges, smelter combustions, and industrial manufacturing accidents.'
    },
    {
      name: 'Persistent Thermal Source',
      badge: 'Permanent Facility',
      style: 'border-persistent-200 bg-persistent-50/50 text-persistent-900',
      badgeStyle: 'bg-persistent-100 text-persistent-800 border-persistent-300',
      dotColor: 'bg-persistent-500',
      count: '3,052 Events (1.36%)',
      description:
        'Stationary, high-temperature industrial production sites that emit predictable thermal radiation continuously over months or years. Distinct from accidents, these reflect authorized continuous or batch manufacturing.',
      examples:
        'Traditional Bulls Trench Brick Kilns, blast furnaces, steel rerolling mills, continuous oil & gas flare stacks, glass manufacturing furnaces, and cement kilns.'
    },
    {
      name: 'Natural Fire',
      badge: 'Vegetation & Biomass',
      style: 'border-hazard-200 bg-hazard-50/50 text-hazard-900',
      badgeStyle: 'bg-hazard-100 text-hazard-800 border-hazard-300',
      dotColor: 'bg-hazard-500',
      count: '24,935 Events (11.13%)',
      description:
        'Rapidly moving, transient combustion of vegetative biomass occurring far from built infrastructure. Exhibited by brief duration (mean persistence: 1.04 days) and greater distance from industrial facilities (mean: 13.13 km).',
      examples:
        'Agricultural crop residue burning (stubble burning), forest wildfires, grassland and savannah fires, scrub burns, and seasonal forest clearing.'
    },
    {
      name: 'Other',
      badge: 'Background / Ambiguous',
      style: 'border-slate-200 bg-slate-50/50 text-slate-900',
      badgeStyle: 'bg-slate-200 text-slate-800 border-slate-300',
      dotColor: 'bg-slate-400',
      count: '193,637 Events (86.43%)',
      description:
        'Low-intensity, ambiguous, or background thermal anomalies that do not satisfy strict operational criteria for industrial facilities or active natural fire fronts.',
      examples:
        'Solar thermal reflection artifacts from galvanized roofs/water bodies, low-confidence single-pass thermal anomalies, and small municipal waste incinerations.'
    }
  ];

  // Authoritative Assets Audit
  const sources = [
    {
      name: 'fire_dataset.csv.xls',
      badge: 'Thermal Observation Repository',
      count: '224,029 Verified Observations',
      size: '23.97 MB CSV Dataset',
      description:
        'Authoritative multi-temporal thermal anomaly observation records containing persistence days, detection counts, Fire Radiative Power (MW), brightness temperatures (I-4, I-5), night ratio, and calculated Euclidean distances to critical OSM infrastructure categories.',
      attributes: [
        'persistence_days', 'detections', 'avg_frp', 'max_frp', 'total_frp',
        'avg_bright_ti4', 'avg_bright_ti5', 'night_ratio',
        'distance_to_industrial_area_km', 'distance_to_power_plant_km',
        'distance_to_quarry_km', 'distance_to_substation_km',
        'distance_to_storage_tank_km', 'distance_to_works_km',
        'prediction_class', 'prediction_confidence', 'fire_type'
      ],
      linkText: 'Dataset Schema Documentation',
      linkUrl: 'https://firms.modaps.eosdis.nasa.gov/'
    },
    {
      name: 'osm_india_features.csv',
      badge: 'Geospatial Infrastructure Dataset',
      count: '139,682 Verified Locations',
      size: '5.58 MB CSV Dataset',
      description:
        'Authoritative geospatial feature coordinates across India extracted from OpenStreetMap. Includes geographical coordinates (latitude, longitude) categorized into 8 distinct infrastructure types (industrial, power_plant, quarry, substation, etc.).',
      attributes: ['latitude', 'longitude', 'feature_category'],
      linkText: 'OpenStreetMap India Infrastructure',
      linkUrl: 'https://www.openstreetmap.org/'
    },
    {
      name: 'fire_type_model.pkl',
      badge: 'Pre-Trained Machine Learning Model',
      count: '200 Decision Tree Estimators',
      size: '208.7 MB Serialized Binary',
      description:
        'Authoritative RandomForestClassifier binary trained to classify thermal anomalies into Industrial Fire, Persistent Thermal Source, Natural Fire, or Other based on 14 input features. Loaded using joblib.load().',
      attributes: [
        '14 strict input features',
        '4 target classes',
        'joblib deserialization',
        'Pre-trained offline weights'
      ],
      linkText: 'scikit-learn Random Forest Model Specification',
      linkUrl: 'https://scikit-learn.org/stable/modules/ensemble.html#forests-of-randomized-trees'
    }
  ];

  return (
    <PageContainer>
      {/* Page Header */}
      <SectionHeader
        badge="Architecture"
        title="Data Sources & ML Pipeline"
        description="Data lineage, feature engineering, and machine learning classification pipeline."
      />

      {/* Triad Architecture Principles Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
              <Satellite className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 block">Spaceborne Layer</span>
              <h3 className="text-xs font-bold text-slate-900">NASA FIRMS Thermal Anomaly</h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">NASA FIRMS provides thermal anomaly detection without classification.</strong> Sensors record radiative power and brightness temperatures to locate anomalies.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">Geospatial Layer</span>
              <h3 className="text-xs font-bold text-slate-900">OSM Infrastructure Context</h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">OpenStreetMap provides spatial context.</strong> Distances to 139,682 industrial complexes, power plants, refineries, and quarries correlate anomalies with infrastructure.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700 block">Inference Layer</span>
              <h3 className="text-xs font-bold text-slate-900">Random Forest Classifier</h3>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-900">Machine learning provides classification.</strong> Fusing multi-temporal persistence with spatial proximity features classifies industrial fires, persistent sources, and natural burns.
          </p>
        </div>
      </div>

      {/* Visual Pipeline Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card">
        <div className="max-w-2xl mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-geo-50 text-geo-700 border border-geo-200 text-xs font-semibold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>End-to-End Processing Flow</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Pipeline Architecture</h2>
          <p className="text-xs text-slate-500 mt-1">
            Data pipeline from infrared sensor telemetry to classification output:
          </p>
        </div>

        {/* Step-by-Step Flow */}
        <div className="space-y-4 relative">
          {pipelineSteps.map((step, idx) => {
            const Icon = step.icon;
            const isLast = idx === pipelineSteps.length - 1;

            return (
              <div key={step.step} className="relative">
                <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
                  {/* Step Number & Icon */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-base font-bold text-slate-400 w-8">{step.step}</span>
                    <div className="p-3 rounded-2xl bg-white border border-slate-200 text-geo-700 shadow-xs">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Step Description */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{step.title}</h3>
                        <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                          • {step.subtitle}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${step.badgeColor}`}>
                        {step.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500">
                      <span>Source: <strong className="text-slate-700">{step.attribution}</strong></span>
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-geo-600 hover:text-geo-700 font-semibold hover:underline"
                        >
                          <span>Documentation</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connecting arrow */}
                {!isLast && (
                  <div className="flex justify-center my-1.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Classes Ontology */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card">
        <div className="max-w-2xl mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-flame-50 text-flame-700 border border-flame-200 text-xs font-semibold mb-2">
            <Crosshair className="w-3.5 h-3.5" />
            <span>Target Classification Ontology</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Target Classes</h2>
          <p className="text-xs text-slate-500 mt-1">
            Characteristics and operational criteria for model output classes:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targetClasses.map((cls) => (
            <div key={cls.name} className={`p-5 rounded-2xl border ${cls.style} flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${cls.dotColor}`} />
                    <h3 className="text-sm font-bold text-slate-900">{cls.name}</h3>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls.badgeStyle}`}>
                    {cls.badge}
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] font-mono font-bold text-slate-700 block mb-1">
                    Empirical Volume: {cls.count}
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed mb-3">
                    {cls.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/60 text-xs">
                <span className="font-semibold text-slate-800 block text-[11px] mb-0.5">Real-World Examples:</span>
                <span className="text-slate-600 leading-relaxed">{cls.examples}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 14 Model Features Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card">
        <div className="max-w-2xl mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold mb-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Feature Engineering Architecture</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Model Input Features</h2>
          <p className="text-xs text-slate-500 mt-1">
            Feature vector schema evaluated by the Random Forest classifier:
          </p>
        </div>

        <div className="space-y-6">
          {featureGroups.map((group) => (
            <div key={group.group} className="space-y-3">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {group.group}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{group.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.features.map((feat) => (
                  <div key={feat.name} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <code className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200">
                          {feat.name}
                        </code>
                        <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {feat.type}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 block mb-2">
                        Unit: {feat.unit}
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Authoritative Datasets Audit */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-card">
        <div className="max-w-2xl mb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold mb-2">
            <Database className="w-3.5 h-3.5" />
            <span>Authoritative Inputs</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Datasets & Model Files</h2>
          <p className="text-xs text-slate-500 mt-1">
            Repository datasets powering the backend and ML services:
          </p>
        </div>

        <div className="space-y-4">
          {sources.map((src) => (
            <div key={src.name} className="bg-slate-50/60 rounded-2xl border border-slate-200 p-6 hover:bg-white hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-3.5 border-b border-slate-200 gap-2">
                <div>
                  <span className="text-[11px] font-bold text-geo-700 uppercase tracking-wider block">
                    {src.badge}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 font-mono mt-0.5">
                    {src.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {src.count}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200">
                    {src.size}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                {src.description}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Attributes ({src.attributes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {src.attributes.map((attr) => (
                      <span
                        key={attr}
                        className="text-[11px] font-mono bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md"
                      >
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>

                {src.linkUrl && (
                  <a
                    href={src.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-geo-600 hover:text-geo-700 shrink-0 self-start sm:self-end hover:underline"
                  >
                    <span>{src.linkText}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mandatory Data-Integrity Protocol Note */}
      <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-6 shadow-card flex items-start gap-4">
        <div className="p-3 bg-amber-100 text-amber-800 rounded-xl border border-amber-300 shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 text-xs text-amber-950 leading-relaxed">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-amber-900">
              Data Integrity & Coordinate Protocol
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 border border-amber-300">
              Spatial Mapping
            </span>
          </div>
          <p>
            <strong className="text-amber-900">Coordinate-to-event relationships derive from spatial mapping.</strong>
          </p>
          <p>
            Observation rows in <code className="bg-white/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 font-mono">fire_dataset.csv.xls</code> and infrastructure locations in <code className="bg-white/80 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200 font-mono">osm_india_features.csv</code> represent independent geospatial layers joined through spatial queries and verified coordinates.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
