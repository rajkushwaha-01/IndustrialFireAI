import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Flame, 
  Map as MapIcon, 
  LayoutDashboard, 
  ListFilter, 
  BarChart3, 
  Database, 
  Info,
  Activity
} from 'lucide-react';

export default function TopNav({ backendHealth, mlHealth }) {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Events', path: '/events', icon: ListFilter },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Data Sources', path: '/data-sources', icon: Database },
    { name: 'About', path: '/about', icon: Info },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Org Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-900/10">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">IndustrialFireAI</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                  NTRO • SIH 26162
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Thermal Anomaly & Infrastructure Geospatial AI</p>
            </div>
          </div>

          {/* Top Navigation Links - NO SIDEBAR */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* System Services Status Indicator */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendHealth?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-medium text-slate-600">API:5000</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    mlHealth?.model_loaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-medium text-slate-600">ML:8000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
