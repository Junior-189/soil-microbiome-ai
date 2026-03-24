import axiosClient from './axiosClient';

export const login = (email, password) =>
  axiosClient.post('/api/auth/login', { email, password }).then((r) => r.data);

export const register = (userData) =>
  axiosClient.post('/api/auth/register', userData).then((r) => r.data);
