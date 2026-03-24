import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Camera, Cpu, BarChart2, Plus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboardStats } from '../../api/analytics';
import { getPredictions } from '../../api/predictions';
import { getTrends } from '../../api/soilReadings';
import { useFarm } from '../../contexts/FarmContext';
import { useSocket } from '../../hooks/useSocket';
import StatCard from '../../components/StatCard';
import LiveReadingTicker from '../../components/LiveReadingTicker';
import RecommendationCard from '../../components/RecommendationCard';
import HealthStatusBadge from '../../components/HealthStatusBadge';

export default function Overview() {
  const { activeFarm } = useFarm();
  const { latestReading, isConnected } = useSocket(activeFarm?.id);
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!activeFarm) return;
      setLoading(true);
      try {
        const [s, t, p] = await Promise.all([
          getDashboardStats(),
          getTrends(activeFarm.id).catch(() => []),
          getPredictions(activeFarm.id, 1, 30).catch(() => ({ predictions: [] })),
        ]);
        setStats(s);
        setTrends(t || []);
        setPredictions(p.predictions || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeFarm]);

  const yieldData = predictions.slice(0, 30).reverse().map((p, i) => ({
    day: i + 1,
    yield: p.predictedYieldTons,
  }));

  const phData = trends.slice(-12).map((t) => ({ week: t.week?.slice(5), ph: t.soilPh }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
        <div className="flex gap-2">
          <button onClick={() => navigate('/dashboard/sensor')} className="flex items-center gap-1.5 px-3 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100">
            <Plus size={16} /> Add Reading
          </button>
          <button onClick={() => navigate('/dashboard/image-analysis')} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100">
            <Camera size={16} /> Analyze Image
          </button>
          <button onClick={() => navigate('/dashboard/yield-prediction')} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-medium hover:bg-green-100">
            <TrendingUp size={16} /> Run Prediction
          </button>
        </div>
      </div>

      {/* Live ticker */}
      <LiveReadingTicker reading={latestReading} isConnected={isConnected} />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Latest Yield Prediction" value={predictions[0]?.predictedYieldTons?.toFixed(2)} unit="t/ha" icon={TrendingUp} color="green" />
        <StatCard title="Image Health Status" value={stats?.latestHealthStatus?.replace('_', ' ') || '—'} icon={Camera} color="purple" />
        <StatCard title="Active Devices" value={stats?.activeDevices ?? '—'} icon={Cpu} color="blue" />
        <StatCard title="Total Analyses" value={stats?.totalImageAnalyses ?? '—'} icon={BarChart2} color="orange" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Predicted Yield — Last 30 Predictions</h3>
          {yieldData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={yieldData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" t/ha" />
                <Tooltip formatter={(v) => [`${v} t/ha`, 'Predicted Yield']} />
                <Line type="monotone" dataKey="yield" stroke="#2d6a4f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No prediction data yet</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Soil pH — Weekly Trend</h3>
          {phData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={phData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[4, 9]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="ph" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No trend data yet</div>
          )}
        </div>
      </div>

      {/* Latest recommendations */}
      {predictions[0]?.recommendations?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Latest Recommendations</h3>
          <div className="space-y-3">
            {predictions[0].recommendations.slice(0, 3).map((r) => (
              <RecommendationCard key={r.id} recommendation={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
