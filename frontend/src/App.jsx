import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { apiClient } from './services/api';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Events from './pages/Events';
import Analytics from './pages/Analytics';
import DataSources from './pages/DataSources';
import About from './pages/About';
import Investigation from './pages/Investigation';
import { DESIGN_TOKENS } from './theme/tokens';

export default function App() {
  const [backendHealth, setBackendHealth] = useState(null);
  const [mlHealth, setMlHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const res = await apiClient.get('/health', { timeout: 3000 });
      setBackendHealth(res.data);
      const mlService = res.data?.services?.mlService;
      setMlHealth(mlService?.reachable
        ? mlService.details
        : { status: mlService?.status || 'offline', model_loaded: false });
    } catch (err) {
      setBackendHealth({ status: 'offline', error: err.message });
      setMlHealth({ status: 'offline', model_loaded: false, error: err.message });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased selection:bg-geo-100 selection:text-geo-900">
        {/* Top Navbar - Strictly No Sidebar */}
        <Navbar backendHealth={backendHealth} mlHealth={mlHealth} />

        {/* Main Content Area */}
        <main className="flex-1 w-full">
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  backendHealth={backendHealth}
                  mlHealth={mlHealth}
                  loadingHealth={loadingHealth}
                  refreshHealth={fetchHealth}
                />
              }
            />
            <Route path="/map" element={<MapView />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<Investigation />} />
            <Route path="/investigate" element={<Investigation />} />
            <Route path="/investigate/:id" element={<Investigation />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/data-sources" element={<DataSources />} />
            <Route path="/datasources" element={<DataSources />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>

        {/* Command Center Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800">{DESIGN_TOKENS.appName}</span>
              <span>•</span>
              <span>{DESIGN_TOKENS.organization}</span>
              <span>•</span>
              <span className="font-mono text-slate-400">SIH PS 26162</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Data Layer Active</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}
