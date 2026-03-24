import axiosClient from './axiosClient';

export const predictYield = (farmId, soilReadingId = null) =>
  axiosClient.post('/api/predict', { farmId, soilReadingId }).then(r => r.data);

export const getPredictions = (farmId, page = 1, limit = 10) =>
  axiosClient.get('/api/predictions', { params: { farmId, page, limit } }).then(r => r.data);

export const getPrediction = (id) =>
  axiosClient.get(`/api/predictions/${id}`).then(r => r.data);

export const updateActualYield = (id, actualYieldTons) =>
  axiosClient.patch(`/api/predictions/${id}/actual`, { actualYieldTons }).then(r => r.data);
