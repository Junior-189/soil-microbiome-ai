import React from 'react';

export default function ConfidenceRing({ confidence = 0, size = 100, healthStatus }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - confidence);

  const statusColors = {
    HEALTHY:  '#16a34a',
    AT_RISK:  '#ca8a04',
    DISEASED: '#ea580c',
    CRITICAL: '#dc2626',
  };
  const color = statusColors[healthStatus] || '#2d6a4f';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x={size / 2} y={size / 2 + 6}
          textAnchor="middle" fontSize={size * 0.2} fontWeight="700"
          fill={color} style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}
        >
          {Math.round(confidence * 100)}%
        </text>
      </svg>
      <span className="text-xs text-gray-500 font-medium">Confidence</span>
    </div>
  );
}
