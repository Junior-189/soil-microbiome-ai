import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ title, value, unit, trend, icon: Icon, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-500 to-primary-600',
    green:   'from-green-500 to-green-600',
    blue:    'from-blue-500 to-blue-600',
    orange:  'from-orange-500 to-orange-600',
    red:     'from-red-500 to-red-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {value ?? '—'}
            {unit && <span className="text-lg font-normal text-gray-500 ml-1">{unit}</span>}
          </p>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'}`}>
              {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
              {Math.abs(trend)}% vs last period
            </div>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color] || colors.primary} text-white shadow`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </div>
  );
}
