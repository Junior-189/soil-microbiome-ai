import React from 'react';

export default function SensorReadingCard({ label, value, unit, optimalMin, optimalMax }) {
  const num = parseFloat(value);
  const hasOptimal = optimalMin !== undefined && optimalMax !== undefined;

  let status = 'normal';
  let pct = 50;

  if (hasOptimal && !isNaN(num)) {
    const range = optimalMax - optimalMin;
    const mid = (optimalMin + optimalMax) / 2;
    const distFromMid = Math.abs(num - mid) / (range / 2);

    if (num < optimalMin * 0.85 || num > optimalMax * 1.15) status = 'danger';
    else if (num < optimalMin || num > optimalMax) status = 'warning';
    else status = 'good';

    // Compute bar position (0–100%)
    const allMin = optimalMin * 0.5;
    const allMax = optimalMax * 1.5;
    pct = Math.min(100, Math.max(0, ((num - allMin) / (allMax - allMin)) * 100));
  }

  const colors = {
    good:    { bg: 'bg-green-50',  border: 'border-green-200', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
    danger:  { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',    bar: 'bg-red-500' },
    normal:  { bg: 'bg-gray-50',   border: 'border-gray-200',   badge: 'bg-gray-100 text-gray-600',  bar: 'bg-gray-400' },
  };
  const c = colors[status];

  return (
    <div className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
      <div className="flex justify-between items-start mb-1">
        <span className="text-xs font-medium text-gray-600 leading-tight">{label}</span>
        {hasOptimal && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.badge}`}>
            {status === 'good' ? '✓ OK' : status === 'warning' ? '△ Low/High' : '✕ Critical'}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {value !== null && value !== undefined ? (typeof value === 'number' ? value.toFixed(2) : value) : '—'}
        <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>
      </div>
      {hasOptimal && (
        <>
          <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${c.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>{optimalMin}{unit}</span>
            <span>optimal</span>
            <span>{optimalMax}{unit}</span>
          </div>
        </>
      )}
    </div>
  );
}
