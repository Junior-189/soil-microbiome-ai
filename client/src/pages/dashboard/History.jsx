import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { getPredictions, updateActualYield } from '../../api/predictions';
import { getAnalyses } from '../../api/imageAnalysis';
import { useFarm } from '../../contexts/FarmContext';
import HealthStatusBadge from '../../components/HealthStatusBadge';

const CATEGORY_COLORS = { POOR: '#dc2626', AVERAGE: '#ca8a04', GOOD: '#2563eb', EXCELLENT: '#16a34a' };

export default function History() {
  const { activeFarm } = useFarm();
  const [tab, setTab] = useState('yield');
  const [predictions, setPredictions] = useState([]);
  const [predTotal, setPredTotal] = useState(0);
  const [predPage, setPredPage] = useState(1);
  const [analyses, setAnalyses] = useState([]);
  const [imgTotal, setImgTotal] = useState(0);
  const [imgPage, setImgPage] = useState(1);
  const [imgFilter, setImgFilter] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [selectedImg, setSelectedImg] = useState(null);

  useEffect(() => { if (activeFarm) loadPredictions(); }, [activeFarm, predPage]);
  useEffect(() => { if (activeFarm) loadAnalyses(); }, [activeFarm, imgPage, imgFilter]);

  async function loadPredictions() {
    try {
      const d = await getPredictions(activeFarm.id, predPage, 10);
      setPredictions(d.predictions || []);
      setPredTotal(d.total || 0);
    } catch {}
  }

  async function loadAnalyses() {
    try {
      const d = await getAnalyses(activeFarm.id, imgPage, imgFilter);
      setAnalyses(d.analyses || []);
      setImgTotal(d.total || 0);
    } catch {}
  }

  async function saveActual(id) {
    if (!editVal) return;
    try {
      await updateActualYield(id, parseFloat(editVal));
      toast.success('Actual yield saved');
      setEditId(null);
      loadPredictions();
    } catch { toast.error('Failed to save'); }
  }

  function exportYieldCsv() {
    const rows = [['Date', 'Predicted (t/ha)', 'Actual (t/ha)', 'Error%', 'Category']];
    predictions.forEach((p) => {
      const err = p.actualYieldTons ? Math.abs(((p.predictedYieldTons - p.actualYieldTons) / p.actualYieldTons) * 100).toFixed(1) : '';
      rows.push([new Date(p.createdAt).toLocaleDateString(), p.predictedYieldTons?.toFixed(3), p.actualYieldTons?.toFixed(3) || '', err, p.yieldCategory]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'yield_history.csv'; a.click();
  }

  function exportImageCsv() {
    const rows = [['Date', 'Type', 'Predicted Class', 'Confidence', 'Health Status']];
    analyses.forEach((a) => {
      rows.push([new Date(a.analyzedAt).toLocaleDateString(), a.imageType, a.predictedClass, (a.confidence * 100).toFixed(1) + '%', a.healthStatus]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'image_history.csv'; a.click();
  }

  const totalPages = (total) => Math.ceil(total / 10);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">History</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['yield', 'Yield Predictions'], ['image', 'Image Analyses']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === v ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Yield Predictions */}
      {tab === 'yield' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-700">Yield Predictions ({predTotal})</h3>
            <button onClick={exportYieldCsv} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Predicted', 'Actual', 'Error %', 'Category', 'Actions'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {predictions.map((p) => {
                  const err = p.actualYieldTons != null
                    ? Math.abs(((p.predictedYieldTons - p.actualYieldTons) / p.actualYieldTons) * 100)
                    : null;
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-600">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono font-semibold">{p.predictedYieldTons?.toFixed(3)} t/ha</td>
                      <td className="py-3 px-4">
                        {editId === p.id ? (
                          <input autoFocus type="number" step="0.01" value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onBlur={() => saveActual(p.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveActual(p.id); }}
                            className="w-20 border border-primary-400 rounded px-2 py-1 text-xs font-mono focus:outline-none" />
                        ) : (
                          <span className="font-mono">
                            {p.actualYieldTons != null ? `${p.actualYieldTons.toFixed(3)} t/ha` : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {err != null ? (
                          <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${err < 10 ? 'bg-green-100 text-green-700' : err < 25 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {err.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: CATEGORY_COLORS[p.yieldCategory] + '22', color: CATEGORY_COLORS[p.yieldCategory] }}>
                          {p.yieldCategory}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {editId !== p.id && (
                          <button onClick={() => { setEditId(p.id); setEditVal(''); }}
                            className="text-xs text-primary-600 hover:underline">
                            {p.actualYieldTons == null ? 'Enter Actual' : 'Edit'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {predictions.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No predictions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {predTotal > 10 && (
            <div className="flex justify-center gap-2 p-4">
              <button onClick={() => setPredPage(p => Math.max(1, p - 1))} disabled={predPage === 1} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {predPage} of {totalPages(predTotal)}</span>
              <button onClick={() => setPredPage(p => p + 1)} disabled={predPage >= totalPages(predTotal)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Image Analyses */}
      {tab === 'image' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 flex-wrap gap-3">
            <div className="flex gap-2">
              {[null, 'SOIL', 'TOMATO', 'CORN'].map((t) => (
                <button key={t || 'all'} onClick={() => { setImgFilter(t); setImgPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${imgFilter === t ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t || 'All'}
                </button>
              ))}
            </div>
            <button onClick={exportImageCsv} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800">
              <Download size={14} /> Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Date', 'Farm', 'Type', 'Predicted Class', 'Confidence', 'Health Status'].map((h) => (
                    <th key={h} className="text-left py-3 px-4 font-semibold text-gray-600 text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analyses.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedImg(a)}>
                    <td className="py-3 px-4 text-gray-600">{new Date(a.analyzedAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-600">{a.farm?.name || '—'}</td>
                    <td className="py-3 px-4"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a.imageType}</span></td>
                    <td className="py-3 px-4 font-medium text-gray-800">{a.predictedClass?.replace(/___/g, ' › ')}</td>
                    <td className="py-3 px-4 font-mono">{(a.confidence * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4"><HealthStatusBadge status={a.healthStatus} size="sm" /></td>
                  </tr>
                ))}
                {analyses.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No analyses yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {imgTotal > 10 && (
            <div className="flex justify-center gap-2 p-4">
              <button onClick={() => setImgPage(p => Math.max(1, p - 1))} disabled={imgPage === 1} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {imgPage}</span>
              <button onClick={() => setImgPage(p => p + 1)} disabled={imgPage * 10 >= imgTotal} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Image Detail Modal */}
      {selectedImg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImg(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">{selectedImg.predictedClass?.replace(/___/g, ' › ')}</h3>
            <p className="text-sm text-gray-400 mb-3">{new Date(selectedImg.analyzedAt).toLocaleString()}</p>
            <HealthStatusBadge status={selectedImg.healthStatus} size="lg" />
            <p className="mt-3 text-sm text-gray-600">Confidence: {(selectedImg.confidence * 100).toFixed(1)}%</p>
            {selectedImg.yieldImpactNote && <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">{selectedImg.yieldImpactNote}</p>}
            <button onClick={() => setSelectedImg(null)} className="w-full mt-4 py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
