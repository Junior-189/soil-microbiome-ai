const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const mlPredict = axios.create({
  baseURL: process.env.ML_ENGINE_URL || 'http://localhost:8000',
  timeout: 30000,
});

const mlTrain = axios.create({
  baseURL: process.env.ML_ENGINE_URL || 'http://localhost:8000',
  timeout: 600000,
});

if (process.env.ML_ENGINE_API_KEY) {
  mlPredict.defaults.headers.common['X-Internal-Key'] = process.env.ML_ENGINE_API_KEY;
  mlTrain.defaults.headers.common['X-Internal-Key'] = process.env.ML_ENGINE_API_KEY;
}

const mlService = {
  async predictYield(sensorData) {
    try {
      const { data } = await mlPredict.post('/tabular/predict', sensorData);
      return data;
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      throw new Error(`Yield prediction failed: ${detail}`);
    }
  },

  async analyzeImage(imageBuffer, filename, datasetType) {
    try {
      const form = new FormData();
      form.append('file', imageBuffer, { filename, contentType: 'image/jpeg' });
      const { data } = await mlPredict.post(
        `/image/predict?dataset_type=${datasetType}`,
        form,
        { headers: form.getHeaders() }
      );
      return data;
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      throw new Error(`Image analysis failed: ${detail}`);
    }
  },

  async getTabularMetrics() {
    try {
      const { data } = await mlPredict.get('/tabular/metrics');
      return data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw new Error(`Failed to get tabular metrics: ${err.message}`);
    }
  },

  async getCNNMetrics() {
    try {
      const { data } = await mlPredict.get('/image/metrics');
      return data;
    } catch (err) {
      if (err.response?.status === 404) return null;
      throw new Error(`Failed to get CNN metrics: ${err.message}`);
    }
  },

  async getModelsStatus() {
    try {
      const { data } = await mlPredict.get('/models/status');
      return data;
    } catch (err) {
      throw new Error(`Failed to get models status: ${err.message}`);
    }
  },

  async getTrainingStatus() {
    try {
      const { data } = await mlPredict.get('/training/status');
      return data;
    } catch (err) {
      if (err.response?.status === 404) return { status: 'idle' };
      throw new Error(`Failed to get training status: ${err.message}`);
    }
  },

  async trainTabular() {
    try {
      const { data } = await mlTrain.post('/tabular/train');
      return data;
    } catch (err) {
      throw new Error(`Failed to start tabular training: ${err.message}`);
    }
  },

  async trainCNN() {
    try {
      const { data } = await mlTrain.post('/image/train');
      return data;
    } catch (err) {
      throw new Error(`Failed to start CNN training: ${err.message}`);
    }
  },

  async trainAll() {
    try {
      const { data } = await mlTrain.post('/train/all');
      return data;
    } catch (err) {
      throw new Error(`Failed to start full training: ${err.message}`);
    }
  },

  async getFeatures() {
    try {
      const { data } = await mlPredict.get('/tabular/features');
      return data;
    } catch (err) {
      throw new Error(`Failed to get features: ${err.message}`);
    }
  },
};

module.exports = mlService;
