import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-xs">
        <p className="font-semibold text-gray-800 text-sm mb-1">{d.feature}</p>
        <p className="text-xs text-gray-600">{d.interpretation}</p>
        <p className={`text-sm font-bold mt-1 ${d.shapValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          SHAP: {d.shapValue >= 0 ? '+' : ''}{d.shapValue?.toFixed(4)}
        </p>
      </div>
    );
  }
  return null;
};

export default function FeatureImportanceChart({ features = [] }) {
  if (!features.length) {
    return <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No SHAP data available</div>;
  }

  const data = [...features].sort((a, b) => Math.abs(b.shapValue) - Math.abs(a.shapValue));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={160} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1.5} />
        <Bar dataKey="shapValue" radius={[0, 4, 4, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.shapValue >= 0 ? '#16a34a' : '#dc2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
