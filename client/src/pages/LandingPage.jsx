import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Camera, TrendingUp, Leaf, ArrowRight, Zap, FlaskConical, BarChart2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const STEPS = [
  { n: 1, icon: Cpu,         title: 'Connect Sensors',      desc: 'Arduino/ESP32 captures real-time soil data — pH, NPK, moisture, microbiome' },
  { n: 2, icon: Camera,      title: 'Upload Crop Images',   desc: 'Photograph soil, tomato, or corn crops for CNN health classification' },
  { n: 3, icon: FlaskConical,title: 'AI Analysis',          desc: 'Two independent models run in parallel: regression + image classification' },
  { n: 4, icon: TrendingUp,  title: 'Yield Prediction',     desc: 'Ensemble of RF + GBM + XGBoost predicts crop yield in tons/ha with SHAP' },
  { n: 5, icon: BarChart2,   title: 'Act on Insights',      desc: 'Receive actionable agronomic recommendations for soil and crop health' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleDemoLogin = async () => {
    try {
      await login('demo@farm.ai', 'demo1234');
      navigate('/dashboard/overview');
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg) {
        toast.error(msg);
      } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        toast.error('Cannot reach the server. Make sure the backend is running on port 5000.');
      } else {
        toast.error('Demo login failed. Run: cd server && npm run seed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-earth-cream font-sans">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-500 rounded-lg"><Leaf size={18} className="text-white" /></div>
          <span className="font-bold text-lg text-gray-800">SoilAI</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/login')} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium text-sm">Login</button>
          <button onClick={() => navigate('/register')} className="px-4 py-2 bg-primary-500 text-white rounded-xl font-medium text-sm hover:bg-primary-600">Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-24 px-6 bg-gradient-to-b from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 text-sm mb-6">
            <Zap size={14} /> AI-Powered Precision Agriculture
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Know Your Soil.<br />See Your Crop.<br />
            <span className="text-green-300">Predict Your Yield.</span>
          </h1>
          <p className="text-xl text-primary-100 max-w-2xl mx-auto mb-10">
            Two independent AI models — tabular regression on real-time sensor data and CNN image classification —
            give you complete visibility into soil microbiome health and crop yield potential.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-primary-700 rounded-2xl font-bold text-base hover:bg-gray-50 flex items-center gap-2 shadow-lg">
              Get Started Free <ArrowRight size={18} />
            </button>
            <button onClick={handleDemoLogin}
              className="px-8 py-4 bg-primary-500 text-white rounded-2xl font-bold text-base hover:bg-primary-400 border-2 border-white/30">
              Try Demo
            </button>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="bg-primary-900 text-white py-4 px-8 flex justify-center gap-12 flex-wrap text-sm">
        {['2 Independent AI Models', 'Real-Time ESP32 Sensors', '3 Crop Types Supported', 'SHAP Explainability'].map((s) => (
          <span key={s} className="font-medium opacity-80">✓ {s}</span>
        ))}
      </div>

      {/* Two AI Models pillar */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 text-center mb-3">Two Independent AI Models</h2>
        <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
          Each model operates independently and produces its own output. Results are displayed side by side.
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl"><Cpu size={24} className="text-blue-600" /></div>
              <div>
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Model 1</div>
                <h3 className="font-bold text-gray-800 text-lg">Tabular Regression</h3>
              </div>
            </div>
            <p className="text-gray-600 mb-4">Trained on real-time soil sensor data. Ensemble of Random Forest + Gradient Boosting + XGBoost predicts crop yield in tons/ha.</p>
            <ul className="space-y-2">
              {['24 soil & microbiome features', 'SHAP feature importance', 'Confidence intervals', 'Nutrient deficiency detection'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 rounded-xl"><Camera size={24} className="text-purple-600" /></div>
              <div>
                <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Model 2</div>
                <h3 className="font-bold text-gray-800 text-lg">CNN Image Classification</h3>
              </div>
            </div>
            <p className="text-gray-600 mb-4">EfficientNetB0 with transfer learning classifies soil and crop images into health categories with yield impact notes.</p>
            <ul className="space-y-2">
              {['Soil, Tomato & Corn datasets', '18 disease/health classes', 'Confidence scoring', 'Treatment recommendations'].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600"><span className="text-green-500">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">How It Works</h2>
          <div className="space-y-6">
            {STEPS.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="flex items-start gap-5">
                <div className="flex-shrink-0 w-12 h-12 bg-primary-500 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow">
                  {n}
                </div>
                <div className="flex items-start gap-4 flex-1">
                  <Icon size={22} className="text-primary-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-800">{title}</h3>
                    <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-600 text-white py-16 px-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to transform your farm?</h2>
        <p className="text-primary-100 mb-8 max-w-md mx-auto">Join farmers using AI to make data-driven decisions on soil health and crop yield.</p>
        <button onClick={() => navigate('/register')}
          className="px-8 py-4 bg-white text-primary-700 font-bold rounded-2xl hover:bg-gray-50 inline-flex items-center gap-2 shadow-lg">
          Start for Free <ArrowRight size={18} />
        </button>
      </section>

      <footer className="bg-gray-900 text-gray-400 text-center py-6 text-sm">
        © 2025 SoilAI — AI-Assisted Soil Microbiome Analysis System
      </footer>
    </div>
  );
}
