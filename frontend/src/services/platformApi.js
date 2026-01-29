import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Instance axios pour les requêtes platform admin
const platformApi = axios.create({
  baseURL: `${API_URL}/platform`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
platformApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('platformToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs d'auth
platformApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('platformToken');
      localStorage.removeItem('platformRefreshToken');
      localStorage.removeItem('platformAdmin');
      window.location.href = '/platform/login';
    }
    return Promise.reject(error);
  }
);

// ====================================
// AUTH
// ====================================
export const platformAuthAPI = {
  login: async (email, password) => {
    const response = await platformApi.post('/auth/login', { email, password });
    return response.data;
  },

  refresh: async (refreshToken) => {
    const response = await platformApi.post('/auth/refresh', { refreshToken });
    return response.data;
  },

  me: async () => {
    const response = await platformApi.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await platformApi.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  logout: async () => {
    const response = await platformApi.post('/auth/logout');
    return response.data;
  },
};

// ====================================
// DASHBOARD
// ====================================
export const platformDashboardAPI = {
  getOverview: async () => {
    const response = await platformApi.get('/dashboard');
    return response.data;
  },

  getStats: async (period = 30) => {
    const response = await platformApi.get('/dashboard/stats', {
      params: { period },
    });
    return response.data;
  },

  getHealth: async () => {
    const response = await platformApi.get('/dashboard/health');
    return response.data;
  },

  getLogs: async (params = {}) => {
    const response = await platformApi.get('/dashboard/logs', { params });
    return response.data;
  },
};

// ====================================
// COMPANIES
// ====================================
export const platformCompaniesAPI = {
  list: async (params = {}) => {
    const response = await platformApi.get('/companies', { params });
    return response.data;
  },

  get: async (id) => {
    const response = await platformApi.get(`/companies/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await platformApi.post('/companies', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await platformApi.put(`/companies/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await platformApi.delete(`/companies/${id}`);
    return response.data;
  },

  getStats: async (id, period = 30) => {
    const response = await platformApi.get(`/companies/${id}/stats`, {
      params: { period },
    });
    return response.data;
  },
};

// ====================================
// INVITATIONS
// ====================================
export const platformInvitationsAPI = {
  list: async (params = {}) => {
    const response = await platformApi.get('/invitations', { params });
    return response.data;
  },

  create: async (data) => {
    const response = await platformApi.post('/invitations', data);
    return response.data;
  },

  createBatch: async (data) => {
    const response = await platformApi.post('/invitations/batch', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await platformApi.put(`/invitations/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await platformApi.delete(`/invitations/${id}`);
    return response.data;
  },

  validate: async (code) => {
    const response = await platformApi.get(`/invitations/validate/${code}`);
    return response.data;
  },
};

// ====================================
// ADMINS
// ====================================
export const platformAdminsAPI = {
  list: async () => {
    const response = await platformApi.get('/admins');
    return response.data;
  },

  create: async (data) => {
    const response = await platformApi.post('/admins', data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await platformApi.put(`/admins/${id}`, data);
    return response.data;
  },

  resetPassword: async (id, newPassword) => {
    const response = await platformApi.post(`/admins/${id}/reset-password`, {
      newPassword,
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await platformApi.delete(`/admins/${id}`);
    return response.data;
  },
};

export default platformApi;
