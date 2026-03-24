import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Plus, Zap, Battery } from 'lucide-react';
import toast from 'react-hot-toast';
import { useFarm } from '../../contexts/FarmContext';
import { useSocket } from '../../hooks/useSocket';
import { getReadings, createReading } from '../../api/soilReadings';
import { getDevices, createDevice, simulateReading, ingestReading } from '../../api/devices';
import LiveReadingTicker from '../../components/LiveReadingTicker';
import SensorReadingCard from '../../components/SensorReadingCard';
import SoilGauge from '../../components/SoilGauge';

const FIELD_GROUPS = {
  Physical: [
    { key: 'soilMoisture', label: 'Soil Moisture', unit: '%', min: 40, max: 70 },
    { key: 'soilTemperature', label: 'Soil Temperature', unit: '°C', min: 15, max: 30 },
    { key: 'electricalConductivity', label: 'EC', unit: 'dS/m', min: 0.2, max: 2.0 },
    { key: 'bulkDensity', label: 'Bulk Density', unit: 'g/cm³', min: 1.0, max: 1.4 },
  ],
  Chemical: [
    { key: 'soilPh', label: 'Soil pH', unit: 'pH', min: 5.5, max: 7.5 },
    { key: 'organicMatter', label: 'Organic Matter', unit: '%', min: 3.0, max: 6.0 },
    { key: 'nitrogenPpm', label: 'Nitrogen (N)', unit: 'ppm', min: 20, max: 60 },
    { key: 'phosphorusPpm', label: 'Phosphorus (P)', unit: 'ppm', min: 15, max: 40 },
    { key: 'potassiumPpm', label: 'Potassium (K)', unit: 'ppm', min: 100, max: 300 },
  ],
  Microbiome: [
    { key: 'microbialDiversityIndex', label: 'Microbial Diversity', unit: 'Shannon', min: 4.0, max: 7.0 },
    { key: 'nitrogenFixingBacteriaRatio', label: 'N-Fixing Bacteria', unit: '%', min: 15, max: 40 },
    { key: 'pathogenicFungiRatio', label: 'Pathogenic Fungi', unit: '%', min: 0, max: 5.0 },
    { key: 'bacterialCountCfu', label: 'Bacterial Count', unit: '×10⁶/g', min: 10, max: 100 },
  ],
  Environmental: [
    { key: 'ambientTemperature', label: 'Ambient Temp', unit: '°C', min: 18, max: 32 },
    { key: 'humidity', label: 'Humidity', unit: '%', min: 50, max: 80 },
    { key: 'rainfallMm', label: 'Rainfall (7d)', unit: 'mm', min: 10, max: 50 },
    { key: 'fertilizerKgPerHa', label: 'Fertilizer Applied', unit: 'kg/ha', min: 100, max: 400 },
  ],
};

export default function SensorDashboard() {
  const [tab, setTab] = useState('live');
  const { activeFarm } = useFarm();
  const { latestReading, isConnected } = useSocket(activeFarm?.id);
  const [displayReading, setDisplayReading] = useState(null);
  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ deviceName: '', deviceSerial: '', deviceType: 'ESP32' });

  useEffect(() => { if (latestReading) setDisplayReading(latestReading); }, [latestReading]);

  useEffect(() => {
    if (activeFarm) loadDevices();
  }, [activeFarm]);

  async function loadDevices() {
    try {
      const d = await getDevices(activeFarm.id);
      setDevices(d);
    } catch {}
  }

  async function handleSimulate() {
    const dev = devices[0];
    if (!dev) return toast.error('No device registered for this farm');
    try {
      const res = await simulateReading(dev.id);
      setDisplayReading(res.simulatedReading);
      setForm(res.simulatedReading);
      toast.success('Simulated reading loaded');
    } catch (err) {
      toast.error('Simulation failed');
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    if (!activeFarm) return;
    setSubmitting(true);
    try {
      await createReading({ farmId: activeFarm.id, ...form });
      toast.success('Reading saved!');
      setForm({});
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save reading');
    } finally { setSubmitting(false); }
  }

  async function handleAddDevice(e) {
    e.preventDefault();
    try {
      await createDevice({ ...newDevice, farmId: activeFarm.id });
      toast.success('Device registered');
      setShowDeviceModal(false);
      loadDevices();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to register device');
    }
  }

  async function handleSimulatePing(device) {
    try {
      await ingestReading(device.deviceSerial, {
        soilMoisture: 52, soilTemperature: 24, soilPh: 6.5,
        electricalConductivity: 1.2, organicMatter: 3.5,
        nitrogenPpm: 35, phosphorusPpm: 22, potassiumPpm: 180,
        ambientTemperature: 28, humidity: 65,
      });
      toast.success(`Reading received from ${device.deviceSerial}`);
      loadDevices();
    } catch { toast.error('Ping failed'); }
  }

  const r = displayReading || {};

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Sensor Dashboard</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {['live', 'manual', 'devices'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all
              ${tab === t ? 'bg-white text-gray-800 shadow' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'live' ? 'Live Feed' : t === 'manual' ? 'Manual Entry' : 'Devices'}
          </button>
        ))}
      </div>

      {/* Live Feed */}
      {tab === 'live' && (
        <div className="space-y-5">
          <LiveReadingTicker reading={displayReading} isConnected={isConnected} />
          <div className="flex gap-3">
            <button onClick={handleSimulate} className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100">
              <Zap size={16} /> Request Simulated Reading
            </button>
          </div>

          {displayReading ? (
            <>
              {/* Gauges for key values */}
              <div className="flex gap-6 flex-wrap">
                <SoilGauge value={r.soilMoisture} label="Moisture" unit="%" />
                <SoilGauge value={r.soilPh ? (r.soilPh / 14) * 100 : 0} label={`pH ${r.soilPh?.toFixed(2) || '—'}`} unit="" />
                <SoilGauge value={r.humidity} label="Humidity" unit="%" />
              </div>

              {/* All reading cards */}
              {Object.entries(FIELD_GROUPS).map(([group, fields]) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {fields.map(({ key, label, unit, min, max }) => (
                      <SensorReadingCard key={key} label={label} value={r[key]} unit={unit} optimalMin={min} optimalMax={max} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="flex items-center justify-center h-40 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm">
              No readings yet. Click "Request Simulated Reading" or connect a device.
            </div>
          )}
        </div>
      )}

      {/* Manual Entry */}
      {tab === 'manual' && (
        <form onSubmit={handleManualSubmit} className="space-y-6 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Add Soil Reading</h3>
            <button type="button" onClick={handleSimulate}
              className="text-sm text-primary-600 hover:underline flex items-center gap-1">
              <Zap size={14} /> Auto-fill from Sensor
            </button>
          </div>

          {Object.entries(FIELD_GROUPS).map(([group, fields]) => (
            <div key={group}>
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{group}</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {fields.map(({ key, label, unit, min, max }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {label} ({unit})
                    </label>
                    <input
                      type="number" step="any"
                      value={form[key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={`${min}–${max}`}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                    {/* pH color slider */}
                    {key === 'soilPh' && (
                      <div className="mt-1 h-1.5 rounded-full"
                        style={{ background: 'linear-gradient(to right, #dc2626 0%, #16a34a 39%, #16a34a 53%, #dc2626 100%)' }} />
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">Optimal: {min}–{max}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Microbiome booleans */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.mycorrhizalFungiPresence}
                onChange={(e) => setForm((f) => ({ ...f, mycorrhizalFungiPresence: e.target.checked }))}
                className="rounded" />
              <span className="text-sm text-gray-700">Mycorrhizal Fungi Present</span>
            </label>
          </div>

          <button type="submit" disabled={submitting || !activeFarm}
            className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 disabled:opacity-60">
            {submitting ? 'Saving...' : 'Save Reading'}
          </button>
        </form>
      )}

      {/* Devices */}
      {tab === 'devices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Registered Devices</h3>
            <button onClick={() => setShowDeviceModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600">
              <Plus size={16} /> Register Device
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((d) => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800">{d.deviceName}</h4>
                    <p className="text-xs text-gray-400 font-mono">{d.deviceSerial}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {d.isOnline ? '● Online' : '○ Offline'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                  <Battery size={12} />
                  {d.batteryLevel ? `${d.batteryLevel.toFixed(0)}%` : 'N/A'}
                  <span className="ml-2">v{d.firmwareVersion || 'N/A'}</span>
                  <span className="ml-auto">{d.deviceType}</span>
                </div>
                {d.lastReadingAt && (
                  <p className="text-xs text-gray-400 mb-3">
                    Last seen: {new Date(d.lastReadingAt).toLocaleString()}
                  </p>
                )}
                <button onClick={() => handleSimulatePing(d)}
                  className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
                  Simulate Ping
                </button>
              </div>
            ))}
            {devices.length === 0 && (
              <div className="col-span-3 text-center py-12 text-gray-400">
                No devices registered yet. Click "Register Device" to add one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device Modal */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddDevice} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-gray-800 text-lg">Register New Device</h3>
            {[['deviceName', 'Device Name', 'e.g. Field Sensor A'], ['deviceSerial', 'Serial Number', 'e.g. ESP-001']].map(([k, l, p]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input value={newDevice[k]} onChange={(e) => setNewDevice((d) => ({ ...d, [k]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  placeholder={p} required />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Type</label>
              <select value={newDevice.deviceType} onChange={(e) => setNewDevice((d) => ({ ...d, deviceType: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                {['ARDUINO', 'ESP32', 'RASPBERRY_PI', 'SIMULATED'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowDeviceModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex-1 py-2 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600">Register</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
