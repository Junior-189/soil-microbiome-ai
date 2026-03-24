import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Cpu, Camera, TrendingUp, Lightbulb, BarChart2, History, ChevronLeft, ChevronRight, Leaf } from 'lucide-react';
import { useFarm } from '../contexts/FarmContext';

const NAV = [
  { to: '/dashboard/overview',         icon: LayoutDashboard, label: 'Overview' },
  { to: '/dashboard/sensor',           icon: Cpu,             label: 'Sensor Data' },
  { to: '/dashboard/image-analysis',   icon: Camera,          label: 'Image Analysis' },
  { to: '/dashboard/yield-prediction', icon: TrendingUp,      label: 'Yield Prediction' },
  { to: '/dashboard/recommendations',  icon: Lightbulb,       label: 'Recommendations' },
  { to: '/dashboard/analytics',        icon: BarChart2,       label: 'Analytics' },
  { to: '/dashboard/history',          icon: History,         label: 'History' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { farms, activeFarm, setActiveFarm } = useFarm();

  return (
    <aside className={`flex flex-col bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} min-h-screen flex-shrink-0`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-700">
        <div className="p-2 bg-primary-500 rounded-xl flex-shrink-0">
          <Leaf size={18} className="text-white" />
        </div>
        {!collapsed && <span className="font-bold text-lg tracking-tight">SoilAI</span>}
      </div>

      {/* Farm Selector */}
      {!collapsed && farms.length > 0 && (
        <div className="px-3 py-3 border-b border-gray-700">
          <label className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Active Farm</label>
          <select
            value={activeFarm?.id || ''}
            onChange={(e) => {
              const f = farms.find((f) => f.id === e.target.value);
              if (f) setActiveFarm(f);
            }}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium
              ${isActive ? 'bg-primary-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-4 border-t border-gray-700 text-gray-400 hover:text-white transition-colors"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}
