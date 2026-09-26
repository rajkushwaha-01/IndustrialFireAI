import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Flame, 
  Map as MapIcon, 
  LayoutDashboard, 
  ListFilter, 
  BarChart3, 
  Database, 
  Info,
  Bell,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';
import { DESIGN_TOKENS } from '../theme/tokens';

export default function Navbar({ backendHealth, mlHealth }) {
  const [showNotifications, setShowNotifications] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Map', path: '/map', icon: MapIcon },
    { name: 'Events', path: '/events', icon: ListFilter },
    { name: 'Investigation', path: '/investigate', icon: Activity },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Data Sources', path: '/data-sources', icon: Database },
    { name: 'About', path: '/about', icon: Info },
  ];

  const notifications = [
    {
      id: 1,
      title: 'Authoritative Dataset Loaded',
      time: 'System Boot',
      desc: '224,029 thermal observations & 139,682 OSM infrastructure points active in data layer.'
    },
    {
      id: 2,
      title: 'ML Model Verified',
      time: 'Model Check',
      desc: 'RandomForestClassifier (200 estimators) ready on port 8000.'
    }
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand & Organization */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 via-slate-800 to-geo-900 flex items-center justify-center text-white shadow-sm ring-1 ring-slate-900/10">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-lg leading-tight">
                  {DESIGN_TOKENS.appName}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold bg-geo-50 text-geo-700 px-2 py-0.5 rounded-full border border-geo-200">
                  NTRO • SIH 26162
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Industrial Fire & Persistent Thermal Source AI
              </p>
            </div>
          </div>

          {/* Desktop Top Navigation - Strictly No Sidebar */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-geo-50 text-geo-700 shadow-xs ring-1 ring-geo-200/60'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right: Live System Status, Notifications & Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Live System Status Badges */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px]">
              <div className="flex items-center gap-1.5" title="Node.js Backend Status">
                <span
                  className={`w-2 h-2 rounded-full ${
                    backendHealth?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono font-medium text-slate-700">API:5000</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5" title="Python ML Service Status">
                <span
                  className={`w-2 h-2 rounded-full ${
                    mlHealth?.model_loaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono font-medium text-slate-700">ML:8000</span>
              </div>
            </div>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="System Notifications"
                aria-label="System Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-elevated p-4 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      System Notifications
                    </span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2.5 mt-3">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-900">
                          <span>{n.title}</span>
                          <span className="text-slate-400">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{n.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Small Profile / System Indicator */}
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shadow-xs">
                <Shield className="w-4 h-4 text-geo-700" />
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">NTRO Analyst</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Geospatial Intelligence</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Navigation Scrollbar */}
        <div className="lg:hidden flex items-center space-x-1 overflow-x-auto py-2 border-t border-slate-100 no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-geo-50 text-geo-700 font-semibold border border-geo-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5 text-slate-500" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </header>
  );
}
