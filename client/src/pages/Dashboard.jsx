import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FarmProvider, useFarm } from '../contexts/FarmContext';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';

function DashboardLayout() {
  const { isAuthenticated, loading } = useAuth();
  const { farms } = useFarm();

  // Also accept a token already in localStorage — covers the one-render gap
  // between setToken() being called and React finishing the state update.
  const hasToken = isAuthenticated || !!localStorage.getItem('token');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasToken) return <Navigate to="/login" replace />;

  const hasOnlineDevice = farms.some((f) => f.devices?.some((d) => d.isOnline));

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar isDeviceOnline={hasOnlineDevice} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <FarmProvider>
      <DashboardLayout />
    </FarmProvider>
  );
}
