import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import { predictYield, getPredictions } from '../../api/predictions';
import { getReadings } from '../../api/soilReadings';
import { useFarm } from '../../contexts/FarmContext';
import LoadingSteps from '../../components/LoadingSteps';
import FeatureImportanceChart from '../../components/FeatureImportanceChart';
import RecommendationCard from '../../components/RecommendationCard';

const PRED_STEPS = [
  'Loading soil parameters...',
  'Analyzing microbiome data...',
  'Running Random Forest...',
  'Running Gradient Boosting...',
  'Running XGBoost...',
  'Computing ensemble prediction...',
  'Calculating SHAP values...',
  'Generating recommendations...',
];

const CATEGORY_COLORS = { POOR: '#dc2626', AVERAGE: '#ca8a04', GOOD: '#2563eb', EXCELLENT: '#16a34a' };

export default function YieldPrediction() {
  const { activeFarm } = useFarm();
  const [predicting, setPredicting] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [latestReading, setLatestReading] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedPred, setSelectedPred] = useState(null);
  const [readingAge, setReadingAge] = useState(null);

  useEffect(() => {
    if (activeFarm) { loadLatestReading(); loadHistory(); }
  }, [activeFarm]);

  async function loadLatestReading() {
    try {
      const d = await getReadings(activeFarm.id, 1, 1);
      if (d.readings?.length > 0) {
        const r = d.readings[0];
        setLatestReading(r);
        const hours = (Date.now() - new Date(r.readingAt).getTime()) / 3600000;
        setReadingAge(Math.round(hours));
      }
    } catch {}
  }

  async function loadHistory() {
    try {
      const d = await getPredictions(activeFarm.id, 1, 5);
      setHistory(d.predictions || []);
    } catch {}
  }

  async function handlePredict() {
    if (!activeFarm) return;
    setPredicting(true);
    setStep(0);
    setResult(null);

    const interval = setInterval(() => setStep((s) => Math.min(s + 1, PRED_STEPS.length - 1)), 700);

    try {
      const r = await predictYield(activeFarm.id);
      clearInterval(interval);
      setStep(PRED_STEPS.length);
      setResult(r);
      toast.success('Prediction complete!');
      loadHistory();
    } catch (err) {
      clearInterval(interval);
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
      toast.error(msg || 'Prediction failed');
      setStep(0);
    } finally {
      setPredicting(false);
    }
  }

  const displayResult = selectedPred || result;
  const catColor = CATEGORY_COLORS[displayResult?.yieldCategory] || '#2d6a4f';

  const microbiomeFeatures = (displayResult?.topFeatures || []).filter(f =>
    ['microbialDiversityIndex', 'nitrogenFixingBacteriaRatio', 'mycorrhizalFungiPresence', 'pathogenicFungiRatio', 'bacterialCountCfu'].includes(f.feature)
  );
  const soilFeatures = (displayResult?.topFeatures || []).filter(f =>
    ['soilPh', 'soilMoisture', 'nitrogenPpm', 'phosphorusPpm', 'potassiumPpm', 'organicMatter', 'electricalConductivity'].includes(f.feature)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold text-gray-800">Yield Prediction</h2>
        <span className="text-sm text-gray-400 font-normal">Tabular Model 1 — RF + GB + XGBoost Ensemble</span>
      </div>

      {/* Latest Reading Summary */}
      {latestReading && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-500">Latest Soil Reading</p>
              <div className="flex gap-4 mt-1">
                {[
                  { l: 'pH', v: latestReading.soilPh?.toFixed(2) },
                  { l: 'Moisture', v: `${latestReading.soilMoisture?.toFixed(1)}%` },
                  { l: 'N', v: `${latestReading.nitrogenPpm?.toFixed(1)} ppm` },
                  { l: 'Microb. Div.', v: latestReading.microbialDiversityIndex?.toFixed(2) },
                ].map(({ l, v }) => (
                  <div key={l} className="text-center">
                    <div className="text-xs text-gray-400">{l}</div>
                    <div className="text-sm font-bold text-gray-700">{v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
            {readingAge > 24 && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl px-3 py-2 text-sm">
                <AlertTriangle size={16} /> Last reading was {readingAge}h ago
              </div>
            )}
          </div>
        </div>
      )}

      {/* Predict Button */}
      <button onClick={handlePredict} disabled={predicting || !activeFarm}
        className="w-full py-5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-2xl font-bold text-lg hover:from-primary-600 hover:to-primary-700 disabled:opacity-60 shadow-lg flex items-center justify-center gap-3 transition-all">
        <Cpu size={24} />
        {predicting ? 'Running AI Models...' : 'Run Yield Prediction'}
      </button>

      {/* Loading steps */}
      {predicting && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <LoadingSteps steps={PRED_STEPS} currentStep={step} isComplete={step >= PRED_STEPS.length} />
        </div>
      )}

      {/* Main layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Results — 2 columns */}
        {displayResult && (
          <div className="lg:col-span-2 space-y-6">
            {/* Big Prediction Card */}
            <div className="bg-white rounded-2xl border-2 p-6 shadow-sm" style={{ borderColor: catColor }}>
              <p className="text-sm text-gray-500 font-medium mb-1">Predicted Crop Yield</p>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-6xl font-black" style={{ color: catColor }}>
                  {displayResult.predictedYieldTons?.toFixed(2)}
                </span>
                <span className="text-2xl text-gray-400 font-light">tons/ha</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Confidence range: {displayResult.confidenceLow?.toFixed(2)} — {displayResult.confidenceHigh?.toFixed(2)} t/ha
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: catColor }}>
                  {displayResult.yieldCategory}
                </span>
                {displayResult.regionalAverage && (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    {displayResult.predictedYieldTons > displayResult.regionalAverage
                      ? <TrendingUp size={16} className="text-green-500" />
                      : <TrendingDown size={16} className="text-red-500" />}
                    {Math.abs(((displayResult.predictedYieldTons - displayResult.regionalAverage) / displayResult.regionalAverage) * 100).toFixed(1)}%
                    vs regional avg ({displayResult.regionalAverage} t/ha)
                  </span>
                )}
              </div>
            </div>

            {/* Individual model breakdown */}
            {displayResult.individualPredictions && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Random Forest', key: 'random_forest', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { name: 'Gradient Boost', key: 'gradient_boosting', color: 'bg-purple-50 border-purple-200 text-purple-700' },
                  { name: 'XGBoost', key: 'xgboost', color: 'bg-orange-50 border-orange-200 text-orange-700' },
                  { name: 'Ensemble', key: null, color: 'bg-green-50 border-green-200 text-green-700' },
                ].map(({ name, key, color }) => (
                  <div key={name} className={`rounded-xl border p-3 text-center ${color}`}>
                    <p className="text-xs font-medium mb-1">{name}</p>
                    <p className="text-xl font-bold">
                      {key ? displayResult.individualPredictions[key]?.toFixed(2) : displayResult.predictedYieldTons?.toFixed(2)}
                    </p>
                    <p className="text-xs opacity-70">t/ha</p>
                  </div>
                ))}
              </div>
            )}

            {/* SHAP */}
            {displayResult.topFeatures?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">SHAP Feature Importance</h3>
                <FeatureImportanceChart features={displayResult.topFeatures} />

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  {[{ title: 'Top Microbiome Drivers', items: microbiomeFeatures },
                    { title: 'Top Soil Drivers', items: soilFeatures }].map(({ title, items }) => (
                    <div key={title}>
                      <h4 className="text-sm font-semibold text-gray-600 mb-2">{title}</h4>
                      <ul className="space-y-1.5">
                        {items.slice(0, 5).map((f) => (
                          <li key={f.feature} className="flex items-center gap-2 text-sm">
                            <span className={`font-mono font-bold ${f.shapValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {f.shapValue >= 0 ? '+' : ''}{f.shapValue?.toFixed(3)}
                            </span>
                            <span className="text-gray-600 text-xs">{f.feature.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </li>
                        ))}
                        {items.length === 0 && <li className="text-xs text-gray-400">No data</li>}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {displayResult.recommendations?.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700">Soil Recommendations</h3>
                {displayResult.recommendations.map((r) => (
                  <RecommendationCard key={r.id || Math.random()} recommendation={r} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Sidebar */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-700">Prediction History</h3>
          {history.map((p) => (
            <button key={p.id} onClick={() => setSelectedPred(selectedPred?.id === p.id ? null : p)}
              className={`w-full text-left bg-white rounded-xl border p-4 hover:border-primary-300 transition-all shadow-sm
                ${selectedPred?.id === p.id ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-800">{p.predictedYieldTons?.toFixed(2)} <span className="text-xs text-gray-400 font-normal">t/ha</span></p>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: CATEGORY_COLORS[p.yieldCategory] + '22', color: CATEGORY_COLORS[p.yieldCategory] }}>
                  {p.yieldCategory}
                </span>
              </div>
            </button>
          ))}
          {history.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No predictions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
