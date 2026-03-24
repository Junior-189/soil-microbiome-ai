import React, { useState, useEffect } from 'react';
import { Filter, Download } from 'lucide-react';
import { getPredictions } from '../../api/predictions';
import { getAnalyses } from '../../api/imageAnalysis';
import { useFarm } from '../../contexts/FarmContext';
import RecommendationCard from '../../components/RecommendationCard';

export default function Recommendations() {
  const { activeFarm } = useFarm();
  const [recs, setRecs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeFarm) loadAll();
  }, [activeFarm]);

  async function loadAll() {
    setLoading(true);
    try {
      const [preds, imgs] = await Promise.all([
        getPredictions(activeFarm.id, 1, 1),
        getAnalyses(activeFarm.id, 1, null, 1),
      ]);

      const soilRecs = (preds.predictions?.[0]?.recommendations || []).map((r) => ({
        ...r, source: 'Soil Analysis', sourceBadge: 'bg-blue-100 text-blue-700',
      }));
      const imgRecs = (imgs.analyses?.[0]?.recommendations || []).map((r) => ({
        ...r, source: 'Image Analysis', sourceBadge: 'bg-purple-100 text-purple-700',
      }));

      const all = [...(soilRecs), ...(imgRecs)];
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      all.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));
      setRecs(all);
    } catch {}
    setLoading(false);
  }

  const filtered = recs.filter((r) => {
    if (filter === 'soil' && r.source !== 'Soil Analysis') return false;
    if (filter === 'image' && r.source !== 'Image Analysis') return false;
    if (severity !== 'all' && r.severity !== severity) return false;
    return true;
  });

  const exportText = () => {
    const lines = filtered.map((r) => [
      `[${r.severity}] ${r.title} (${r.source})`,
      r.description,
      ...(r.actionItems?.map((a) => `  • ${a}`) || []),
      '',
    ].join('\n')).join('\n');
    const blob = new Blob([`Soil Microbiome AI — Recommendations Report\n${'='.repeat(50)}\n\n${lines}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recommendations.txt'; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Recommendations</h2>
        <button onClick={exportText} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
          <Download size={16} /> Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[['all', 'All'], ['soil', 'Soil Sensor'], ['image', 'Image Analysis']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === v ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {[['all', 'Any Severity'], ['CRITICAL', 'Critical'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']].map(([v, l]) => (
            <button key={v} onClick={() => setSeverity(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${severity === v ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading recommendations...</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          No recommendations match the current filters
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => (
            <div key={i} className="relative">
              <span className={`absolute -top-2 right-4 text-xs px-2 py-0.5 rounded-full font-medium z-10 ${r.sourceBadge}`}>
                {r.source}
              </span>
              <RecommendationCard recommendation={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
