import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Leaf } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { register as apiRegister } from '../api/auth';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [tab, setTab] = useState(window.location.pathname === '/register' ? 'register' : 'login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', farmLocation: '', farmSizeHa: '' });
  const { login, loginWithData, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  if (isAuthenticated) return <Navigate to="/dashboard/overview" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard/overview');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('All fields required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Invalid email');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (form.password !== form.confirm) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const { token, user } = await apiRegister({ name: form.name, email: form.email, password: form.password, farmLocation: form.farmLocation, farmSizeHa: form.farmSizeHa });
      loginWithData(token, user);
      toast.success('Welcome! Your account has been created.');
      navigate('/dashboard/overview');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent";

  return (
    <div className="min-h-screen bg-earth-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary-500 rounded-xl"><Leaf size={20} className="text-white" /></div>
            <span className="font-bold text-2xl text-gray-800">SoilAI</span>
          </div>
          <p className="text-gray-500 text-sm">AI-Assisted Soil Microbiome Analysis</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {['login', 'register'].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all
                  ${tab === t ? 'bg-white text-gray-800 shadow' : 'text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="you@farm.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} className={inputClass} placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition-colors">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input value={form.name} onChange={set('name')} className={inputClass} placeholder="John Farmer" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className={inputClass} placeholder="you@farm.com" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')} className={inputClass} placeholder="Min 8 chars" required />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-400">
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input type="password" value={form.confirm} onChange={set('confirm')} className={inputClass} placeholder="Repeat password" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm Location</label>
                  <input value={form.farmLocation} onChange={set('farmLocation')} className={inputClass} placeholder="e.g. Nairobi, Kenya" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Farm Size (ha)</label>
                  <input type="number" step="0.1" value={form.farmSizeHa} onChange={set('farmSizeHa')} className={inputClass} placeholder="e.g. 5.0" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60 transition-colors">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-gray-500 mt-4">
          <button onClick={() => navigate('/')} className="text-primary-600 hover:underline">← Back to home</button>
        </p>
      </div>
    </div>
  );
}
