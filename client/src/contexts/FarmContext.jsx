import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getFarms } from '../api/farms';
import { useAuth } from './AuthContext';

const FarmContext = createContext(null);

export function FarmProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [farms, setFarms] = useState([]);
  const [activeFarm, setActiveFarmState] = useState(null);
  const [loading, setLoading] = useState(false);

  const setActiveFarm = useCallback((farm) => {
    setActiveFarmState(farm);
    if (farm) localStorage.setItem('activeFarmId', farm.id);
  }, []);

  const refreshFarms = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await getFarms();
      setFarms(data);
      const savedId = localStorage.getItem('activeFarmId');
      const saved = data.find((f) => f.id === savedId);
      if (saved) {
        setActiveFarmState(saved);
      } else if (data.length > 0) {
        setActiveFarmState(data[0]);
        localStorage.setItem('activeFarmId', data[0].id);
      }
    } catch (err) {
      console.error('Failed to load farms:', err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refreshFarms();
    else { setFarms([]); setActiveFarmState(null); }
  }, [isAuthenticated, refreshFarms]);

  return (
    <FarmContext.Provider value={{ farms, activeFarm, setActiveFarm, refreshFarms, loading }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
}
