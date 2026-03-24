import React, { useState, useEffect } from 'react';
import { Camera, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyzeImage, getAnalyses, getImageUrl } from '../../api/imageAnalysis';
import { useFarm } from '../../contexts/FarmContext';
import ImageDropzone from '../../components/ImageDropzone';
import HealthStatusBadge from '../../components/HealthStatusBadge';
import ConfidenceRing from '../../components/ConfidenceRing';
import RecommendationCard from '../../components/RecommendationCard';
import LoadingSteps from '../../components/LoadingSteps';

const STEPS = [
  'Uploading image...',
  'Preprocessing (224×224)...',
  'Running EfficientNet model...',
  'Classifying disease/health...',
  'Generating recommendations...',
];

export default function ImageAnalysis() {
  const { activeFarm } = useFarm();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [datasetType, setDatasetType] = useState('tomato');
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [histPage, setHistPage] = useState(1);
  const [histTotal, setHistTotal] = useState(0);
  const [filterType, setFilterType] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  useEffect(() => { if (activeFarm) loadHistory(); }, [activeFarm, histPage, filterType]);

  async function loadHistory() {
    try {
      const d = await getAnalyses(activeFarm.id, histPage, filterType);
      setHistory(d.analyses || []);
      setHistTotal(d.total || 0);
    } catch {}
  }

  function handleFileAccepted(f) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  }

  async function handleAnalyze() {
    if (!file || !activeFarm) return;
    setAnalyzing(true);
    setStep(0);
    setResult(null);

    const interval = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);

    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('farmId', activeFarm.id);
      fd.append('datasetType', datasetType);
      const r = await analyzeImage(fd);
      clearInterval(interval);
      setStep(STEPS.length);
      setResult(r);
      toast.success('Analysis complete');
      loadHistory();
    } catch (err) {
      clearInterval(interval);
      const msg = err.response?.data?.detail || err.response?.data?.error || err.message;
      toast.error(msg);
      setStep(0);
    } finally {
      setAnalyzing(false);
    }
  }

  const classScoreData = result ? Object.entries(result.allClassScores || {})
    .sort((a, b) => b[1] - a[1])
    .map(([cls, score]) => ({ name: cls.split('___').pop()?.replace(/_/g, ' '), score: Math.round(score * 100) }))
    : [];

  const HEALTH_COLORS = { HEALTHY: '#16a34a', AT_RISK: '#ca8a04', DISEASED: '#ea580c', CRITICAL: '#dc2626' };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Camera size={24} className="text-purple-500" /> Image Analysis
        <span className="text-sm font-normal text-gray-400 ml-2">CNN Model 2 — EfficientNetB0</span>
      </h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upload Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-gray-700">Upload Image</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dataset Type</label>
              <div className="flex gap-2">
                {['soil', 'tomato', 'corn'].map((t) => (
                  <button key={t} onClick={() => setDatasetType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition-all
                      ${datasetType === t ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-300 hover:border-primary-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <ImageDropzone onFileAccepted={handleFileAccepted} isLoading={analyzing} preview={preview} onClear={() => { setFile(null); setPreview(null); setResult(null); }} />

            {file && <p className="text-xs text-gray-400">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}

            {analyzing && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <LoadingSteps steps={STEPS} currentStep={step} isComplete={step >= STEPS.length} />
              </div>
            )}

            <button onClick={handleAnalyze} disabled={!file || analyzing || !activeFarm}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              <Camera size={18} />
              {analyzing ? 'Analyzing...' : 'Analyze Image'}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {result ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <HealthStatusBadge status={result.healthStatus} size="lg" />
                    <h3 className="font-bold text-gray-800 text-xl mt-2">{result.predictedClass?.replace(/___/g, ' › ')}</h3>
                  </div>
                  <ConfidenceRing confidence={result.confidence} healthStatus={result.healthStatus} size={90} />
                </div>

                {result.yieldImpactNote && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">
                    {result.yieldImpactNote}
                  </div>
                )}

                {classScoreData.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-2">All Class Scores</p>
                    <ResponsiveContainer width="100%" height={classScoreData.length * 28 + 20}>
                      <BarChart data={classScoreData} layout="vertical">
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                        <Tooltip formatter={(v) => [`${v}%`, 'Confidence']} />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                          {classScoreData.map((_, i) => <Cell key={i} fill={i === 0 ? '#7c3aed' : '#e5e7eb'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {result.recommendations?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Recommendations</h4>
                  {result.recommendations.map((r, i) => (
                    <RecommendationCard key={i} recommendation={r} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64 text-gray-400 text-sm">
              Upload and analyze an image to see results here
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700">Analysis History</h3>
          <div className="flex gap-2">
            {[null, 'SOIL', 'TOMATO', 'CORN'].map((t) => (
              <button key={t || 'all'} onClick={() => { setFilterType(t); setHistPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all
                  ${filterType === t ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {t || 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {history.map((a) => (
            <button key={a.id} onClick={() => setSelectedAnalysis(a)}
              className="text-left group border border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 transition-all">
              <div className="h-24 bg-gray-100 flex items-center justify-center relative">
                <Camera size={24} className="text-gray-300" />
                <HealthStatusBadge status={a.healthStatus} size="sm" className="absolute top-1 left-1" />
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-700 truncate">{a.predictedClass?.split('___').pop()?.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-400">{(a.confidence * 100).toFixed(0)}% · {a.imageType}</p>
                <p className="text-xs text-gray-300">{new Date(a.analyzedAt).toLocaleDateString()}</p>
              </div>
            </button>
          ))}
          {history.length === 0 && (
            <div className="col-span-5 text-center py-8 text-gray-400 text-sm">No analyses yet</div>
          )}
        </div>

        {histTotal > 20 && (
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setHistPage(p => Math.max(1, p - 1))} disabled={histPage === 1}
              className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Prev</button>
            <span className="px-3 py-1 text-sm text-gray-600">Page {histPage}</span>
            <button onClick={() => setHistPage(p => p + 1)} disabled={histPage * 20 >= histTotal}
              className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-40">Next</button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAnalysis(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <HealthStatusBadge status={selectedAnalysis.healthStatus} size="lg" />
                <h3 className="font-bold text-gray-800 text-lg mt-2">{selectedAnalysis.predictedClass?.replace(/___/g, ' › ')}</h3>
                <p className="text-sm text-gray-400">{new Date(selectedAnalysis.analyzedAt).toLocaleString()}</p>
              </div>
              <ConfidenceRing confidence={selectedAnalysis.confidence} healthStatus={selectedAnalysis.healthStatus} size={70} />
            </div>
            {selectedAnalysis.yieldImpactNote && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">{selectedAnalysis.yieldImpactNote}</p>
            )}
            <button onClick={() => setSelectedAnalysis(null)} className="w-full py-2 bg-gray-100 rounded-xl text-sm font-medium hover:bg-gray-200 mt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
