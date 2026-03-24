import axiosClient from './axiosClient';

export const getFarms = () => axiosClient.get('/api/farms').then(r => r.data);
export const getFarm = (id) => axiosClient.get(`/api/farms/${id}`).then(r => r.data);
export const createFarm = (data) => axiosClient.post('/api/farms', data).then(r => r.data);
export const updateFarm = (id, data) => axiosClient.put(`/api/farms/${id}`, data).then(r => r.data);
export const deleteFarm = (id) => axiosClient.delete(`/api/farms/${id}`).then(r => r.data);
