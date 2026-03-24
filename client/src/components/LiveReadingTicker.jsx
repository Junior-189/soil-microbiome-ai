import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function LiveReadingTicker({ reading, isConnected }) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (reading) {
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
  }, [reading]);

  const fields = reading ? [
    { label: 'pH',       value: reading.soilPh?.toFixed(2) },
    { label: 'Moisture', value: reading.soilMoisture?.toFixed(1), unit: '%' },
    { label: 'Soil °C',  value: reading.soilTemperature?.toFixed(1), unit: '°C' },
    { label: 'N',        value: reading.nitrogenPpm?.toFixed(1), unit: 'ppm' },
    { label: 'P',        value: reading.phosphorusPpm?.toFixed(1), unit: 'ppm' },
    { label: 'K',        value: reading.potassiumPpm?.toFixed(0), unit: 'ppm' },
  ] : [];

  return (
    <div className={`flex items-center gap-4 bg-gray-900 text-white rounded-xl px-4 py-3 transition-all ${animate ? 'ring-2 ring-green-400' : ''}`}>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isConnected
          ? <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /><Wifi size={14} className="text-green-400" /></>
          : <><span className="w-2 h-2 rounded-full bg-gray-500" /><WifiOff size={14} className="text-gray-500" /></>
        }
        <span className="text-xs font-medium text-gray-400">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      {fields.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto flex-1">
          {fields.map(({ label, value, unit }) => (
            <div key={label} className="flex-shrink-0 text-center">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="text-sm font-bold text-green-300">{value ?? '—'}{unit}</div>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-sm text-gray-500 flex-1">
          {isConnected ? 'Waiting for sensor data...' : 'Connect a device to see live readings'}
        </span>
      )}
    </div>
  );
}
