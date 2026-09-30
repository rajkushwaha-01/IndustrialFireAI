import React from 'react';
import PageContainer from '../components/PageContainer';
import SectionHeader from '../components/SectionHeader';
import { 
  Building2, 
  Code2
} from 'lucide-react';
import { DESIGN_TOKENS } from '../theme/tokens';

export default function About() {
  return (
    <PageContainer>
      <SectionHeader
        badge="NTRO • SIH 26162"
        title="About ThermalWatch"
        description="Thermal anomaly discrimination system distinguishing between industrial emissions and natural fires."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Problem Statement Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-geo-50 text-geo-700 flex items-center justify-center border border-geo-200">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-geo-700 uppercase tracking-wider block">
                Problem Statement ID 26162
              </span>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                AI-Based Detection and Classification of Industrial Fires & Persistent Thermal Sources
              </h2>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
            <p>
              <strong className="text-slate-900">Organization:</strong> National Technical Research Organisation (NTRO)
            </p>
            <p>
              <strong className="text-slate-900">Operational Challenge:</strong> Satellite active fire products detect thermal anomalies without classification. Distinguishing persistent industrial operations from seasonal vegetation burns is critical for hazard response.
            </p>
            <p>
              <strong className="text-slate-900">ML Solution:</strong> Multi-temporal persistence metrics and spatial distances to OpenStreetMap infrastructure evaluated by a 200-estimator Random Forest classifier.
            </p>
          </div>
        </div>

        {/* Technology Architecture Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                Decoupled Architecture
              </span>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                System Architecture
              </h2>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Frontend: React + Vite + Tailwind CSS</span>
                <span className="text-[11px] font-mono text-slate-500">Port 5173</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Leaflet maps, real-time filters, and telemetry dashboards.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>Backend: Node.js Express Data Layer</span>
                <span className="text-[11px] font-mono text-slate-500">Port 5000</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                REST API, high-speed streaming CSV repository (224k rows in 0.5s), modular PostGIS layer.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>ML Inference Service: Python FastAPI</span>
                <span className="text-[11px] font-mono text-slate-500">Port 8000</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Pre-trained RandomForestClassifier loaded via joblib, strict 14-feature Pydantic validation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
