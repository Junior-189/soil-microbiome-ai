import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Line, LineChart, ReferenceLine, Legend } from 'recharts';
import { getModelPerformance, getPredictionAccuracy } from '../../api/analytics';
import { getTrends } from '../../api/soilReadings';
import { useFarm } from '../../contexts/FarmContext';
import ModelComparisonTable from '../../components/ModelComparisonTable';
import StatCard from '../../components/StatCard';
import { BarChart2, TrendingUp, Target, Camera } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Analytics() {
  const { activeFarm } = useFarm();
  const [tab, setTab] = useState('soil');
  const [perf, setPerf] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, [activeFarm]);

  async function loadAll() {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        getModelPerformance(),
        activeFarm ? getTrends(activeFarm.id).catch(() => []) : Promise.resolve([]),
      ]);
      setPerf(p);
      setTrends(t || []);
      if (activeFarm) {
        const a = await getPredictionAccuracy(activeFarm.id).catch(() => null);
        setAccuracy(a);
      }
    } catch {
      toast.error('Failed to load analytics data. Check server connection.');
    }
    setLoading(false);
  }

  const tabularMetrics = perf?.tabular || {};
  const cnnMetrics = perf?.cnn || {};

  const bestR2 = tabularMetrics?.ensemble?.r2 || tabularMetrics?.xgboost?.r2;
  const bestRmse = tabularMetrics?.ensemble?.rmse || tabularMetrics?.xgboost?.rmse;

  // Scatter data: predicted vs actual
  const scatterData = (accuracy?.predictions || []).map((p) => ({
    x: p.actualYieldTons,
    y: p.predictedYieldTons,
  }));

  // Per-class CNN F1
  const makeCnnBarData = (datasetName) => {
    const m = cnnMetrics[datasetName];
    if (!m?.per_class) return [];
    return Object.entries(m.per_class).map(([cls, v]) => ({
      name: cls.split('___').pop()?.replace(/_/g, ' ') || cls,
      f1: Math.round((v.f1_score || 0) * 100),
    }));
  };

  const trendData = trends.slice(-12).map((t) => ({
    week: t.week?.slice(5),
    pH: t.soilPh,
    moisture: t.soilMoisture,
    organicMatter: t.organicMatter,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Model Analytics</h2>

      {/* Model tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('soil')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'soil' ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
          <BarChart2 size={16} /> Soil Model
        </button>
        <button onClick={() => setTab('image')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'image' ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
          <Camera size={16} /> Image Model
        </button>
      </div>

      {/* Soil Model */}
      {tab === 'soil' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <StatCard title="Best Ensemble R²" value={bestR2?.toFixed(4) ?? '—'} icon={Target} color="green" />
            <StatCard title="Best Ensemble RMSE" value={bestRmse?.toFixed(4) ?? '—'} unit="t/ha" icon={TrendingUp} color="blue" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Model Comparison — 5-Fold Cross Validation</h3>
            {loading ? <div className="h-20 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
              : <ModelComparisonTable metrics={tabularMetrics} type="tabular" />}
          </div>

          {/* Predicted vs Actual */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Predicted vs Actual Yield</h3>
            {scatterData.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center"><p className="text-xs text-gray-400">RMSE</p><p className="font-bold text-gray-800">{accuracy.rmse?.toFixed(4)}</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">MAE</p><p className="font-bold text-gray-800">{accuracy.mae?.toFixed(4)}</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">R²</p><p className="font-bold text-gray-800">{accuracy.r2?.toFixed(4) ?? '—'}</p></div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="Actual" unit=" t/ha" tick={{ fontSize: 11 }} label={{ value: 'Actual (t/ha)', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" name="Predicted" unit=" t/ha" tick={{ fontSize: 11 }} label={{ value: 'Predicted (t/ha)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 15, y: 15 }]} stroke="#9ca3af" strokeDasharray="4" label={{ value: 'Perfect', fontSize: 10 }} />
                    <Scatter data={scatterData} fill="#2d6a4f" opacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Enter actual yield values in History → Yield Predictions to see accuracy metrics
              </div>
            )}
          </div>

          {/* Soil Trends */}
          {trendData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">Soil Parameter Trends</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pH" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="moisture" stroke="#16a34a" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="organicMatter" stroke="#ca8a04" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Image Model */}
      {tab === 'image' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {['soil', 'tomato', 'corn'].map((ds) => {
              const m = cnnMetrics[ds];
              return (
                <div key={ds} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-700 capitalize">{ds} CNN</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${m ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m ? 'Trained' : 'Not Trained'}
                    </span>
                  </div>
                  {m ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Accuracy</span><span className="font-bold text-gray-800">{(m.accuracy * 100).toFixed(1)}%</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Classes</span><span className="font-bold text-gray-800">{m.num_classes}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-gray-500">Samples</span><span className="font-bold text-gray-800">{m.training_samples?.toLocaleString()}</span></div>
                    </div>
                  ) : <p className="text-xs text-gray-400">No model trained. Add images to ml-engine/data/{ds}/</p>}
                </div>
              );
            })}
          </div>

          {/* Per-class F1 for each model */}
          {['soil', 'tomato', 'corn'].map((ds) => {
            const barData = makeCnnBarData(ds);
            if (!barData.length) return null;
            return (
              <div key={ds} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4 capitalize">{ds} CNN — Per-Class F1 Score</h3>
                <ResponsiveContainer width="100%" height={barData.length * 30 + 40}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v) => [`${v}%`, 'F1 Score']} />
                    <Bar dataKey="f1" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
