import axiosClient from './axiosClient';

export const analyzeImage = (formData) =>
  axiosClient.post('/api/image/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }).then(r => r.data);

export const getAnalyses = (farmId, page = 1, imageType = null, limit = 20) =>
  axiosClient.get('/api/image/analyses', {
    params: { farmId, page, limit, ...(imageType ? { imageType } : {}) },
  }).then(r => r.data);

export const getAnalysis = (id) =>
  axiosClient.get(`/api/image/analyses/${id}`).then(r => r.data);

export const getImageUrl = (id) =>
  `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/image/analyses/${id}/image`;
