import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { FarmProvider } from './contexts/FarmContext';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Overview from './pages/dashboard/Overview';
import SensorDashboard from './pages/dashboard/SensorDashboard';
import ImageAnalysis from './pages/dashboard/ImageAnalysis';
import YieldPrediction from './pages/dashboard/YieldPrediction';
import Recommendations from './pages/dashboard/Recommendations';
import Analytics from './pages/dashboard/Analytics';
import History from './pages/dashboard/History';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<Navigate to="/dashboard/overview" replace />} />
            <Route path="overview" element={<Overview />} />
            <Route path="sensor" element={<SensorDashboard />} />
            <Route path="image-analysis" element={<ImageAnalysis />} />
            <Route path="yield-prediction" element={<YieldPrediction />} />
            <Route path="recommendations" element={<Recommendations />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
