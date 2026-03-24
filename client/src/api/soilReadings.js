import axiosClient from './axiosClient';

export const getReadings = (farmId, page = 1, limit = 20) =>
  axiosClient.get('/api/soil-readings', { params: { farmId, page, limit } }).then(r => r.data);

export const createReading = (data) =>
  axiosClient.post('/api/soil-readings', data).then(r => r.data);

export const deleteReading = (id) =>
  axiosClient.delete(`/api/soil-readings/${id}`).then(r => r.data);

export const getTrends = (farmId) =>
  axiosClient.get(`/api/soil-readings/trends/${farmId}`).then(r => r.data);
