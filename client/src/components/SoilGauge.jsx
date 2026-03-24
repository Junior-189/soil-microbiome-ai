import React, { useEffect, useRef } from 'react';

export default function SoilGauge({ value = 0, label = '', unit = '%' }) {
  const clamp = Math.min(100, Math.max(0, value));
  const angle = -135 + (clamp / 100) * 270;

  const color = clamp < 30 ? '#dc2626' : clamp < 60 ? '#ca8a04' : '#16a34a';

  // Arc path helpers
  const polarToXY = (deg, r) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  };

  const describeArc = (startDeg, endDeg, r) => {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const needle = polarToXY(angle, 32);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 90" className="w-32 h-24">
        {/* Background arc */}
        <path d={describeArc(-135, 135, 40)} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
        {/* Value arc */}
        {clamp > 0 && (
          <path d={describeArc(-135, -135 + (clamp / 100) * 270, 40)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" />
        )}
        {/* Needle */}
        <line x1="60" y1="60" x2={needle.x} y2={needle.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="60" r="4" fill={color} />
        {/* Value text */}
        <text x="60" y="80" textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
          {typeof value === 'number' ? value.toFixed(1) : value}{unit}
        </text>
      </svg>
      <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
    </div>
  );
}
