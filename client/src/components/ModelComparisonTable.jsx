import React from 'react';
import { Trophy } from 'lucide-react';

export default function ModelComparisonTable({ metrics = {}, type = 'tabular' }) {
  const entries = Object.entries(metrics);
  if (!entries.length) {
    return <div className="text-gray-400 text-sm text-center py-8">No model metrics available yet. Train a model to see results.</div>;
  }

  const isTabular = type === 'tabular';

  // Find best values
  const bestRmse = isTabular ? Math.min(...entries.map(([, m]) => m.rmse).filter(Boolean)) : null;
  const bestMae  = isTabular ? Math.min(...entries.map(([, m]) => m.mae).filter(Boolean))  : null;
  const bestR2   = isTabular ? Math.max(...entries.map(([, m]) => m.r2).filter(Boolean))   : null;
  const bestAcc  = !isTabular ? Math.max(...entries.map(([, m]) => m.accuracy).filter(Boolean)) : null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">Model</th>
            {isTabular ? (
              <>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">RMSE ↓</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">MAE ↓</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">R² ↑</th>
              </>
            ) : (
              <>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Accuracy ↑</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Classes</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Samples</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, m], i) => (
            <tr key={name} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
              <td className="py-3 px-4 font-medium text-gray-800 capitalize">
                {name.replace(/_/g, ' ')}
              </td>
              {isTabular ? (
                <>
                  <td className={`py-3 px-4 text-right font-mono ${m.rmse === bestRmse ? 'text-green-600 font-bold' : 'text-gray-700'}`}>
                    {m.rmse?.toFixed(4) ?? '—'}
                    {m.rmse === bestRmse && <Trophy size={12} className="inline ml-1 text-yellow-500" />}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${m.mae === bestMae ? 'text-green-600 font-bold' : 'text-gray-700'}`}>
                    {m.mae?.toFixed(4) ?? '—'}
                    {m.mae === bestMae && <Trophy size={12} className="inline ml-1 text-yellow-500" />}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono ${m.r2 === bestR2 ? 'text-green-600 font-bold' : 'text-gray-700'}`}>
                    {m.r2?.toFixed(4) ?? '—'}
                    {m.r2 === bestR2 && <Trophy size={12} className="inline ml-1 text-yellow-500" />}
                  </td>
                </>
              ) : (
                <>
                  <td className={`py-3 px-4 text-right font-mono ${m.accuracy === bestAcc ? 'text-green-600 font-bold' : 'text-gray-700'}`}>
                    {m.accuracy ? `${(m.accuracy * 100).toFixed(1)}%` : '—'}
                    {m.accuracy === bestAcc && <Trophy size={12} className="inline ml-1 text-yellow-500" />}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700">{m.num_classes ?? '—'}</td>
                  <td className="py-3 px-4 text-right text-gray-700">{m.training_samples?.toLocaleString() ?? '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
