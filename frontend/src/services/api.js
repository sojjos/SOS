import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour les requêtes
api.interceptors.request.use(
  (config) => {
    // Le token est ajouté automatiquement par le store d'auth
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour les réponses
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Si erreur 401 et pas encore réessayé
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Vérifier si c'est une erreur de token expiré
      if (error.response?.data?.code === 'TOKEN_EXPIRED') {
        // Importer le store dynamiquement pour éviter les dépendances circulaires
        const { default: useAuthStore } = await import('../store/authStore');
        const refreshed = await useAuthStore.getState().refreshAccessToken();

        if (refreshed) {
          // Réessayer la requête avec le nouveau token
          const token = useAuthStore.getState().token;
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// Services API spécifiques
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password })
};

export const ticketsAPI = {
  list: (params) => api.get('/tickets', { params }),
  get: (id) => api.get(`/tickets/${id}`),
  create: (data) => api.post('/tickets', data),
  validate: (id, data) => api.put(`/tickets/${id}/validate`, data),
  updateStatus: (id, data) => api.put(`/tickets/${id}/status`, data),
  addComment: (id, data) => api.post(`/tickets/${id}/comments`, data),
  toggleUnionVisibility: (id, visible) => api.put(`/tickets/${id}/visibility`, { visible_to_union: visible })
};

export const dashboardAPI = {
  personal: (agencyId) => api.get('/dashboard/personal', { params: { agency_id: agencyId } }),
  team: (agencyId) => api.get('/dashboard/team', { params: { agency_id: agencyId } }),
  site: (agencyId) => api.get('/dashboard/site', { params: { agency_id: agencyId } }),
  direction: (agencyId) => api.get('/dashboard/direction', { params: { agency_id: agencyId } }),
  multiSites: () => api.get('/dashboard/multi-sites')
};

export const agenciesAPI = {
  list: () => api.get('/agencies'),
  get: (id) => api.get(`/agencies/${id}`),
  getConfig: (id) => api.get(`/agencies/${id}/config`),
  getProblemTypes: (id) => api.get(`/agencies/${id}/problem-types`),
  getLocations: (id) => api.get(`/agencies/${id}/locations`),
  getHierarchyLevels: (id) => api.get(`/agencies/${id}/hierarchy-levels`)
};

export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  getTeam: (agencyId) => api.get('/users/team', { params: { agency_id: agencyId } })
};

export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  count: () => api.get('/notifications/count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  preferences: () => api.get('/notifications/preferences'),
  updatePreferences: (prefs) => api.put('/notifications/preferences', { preferences: prefs })
};

export const adminAPI = {
  // Agences
  createAgency: (data) => api.post('/admin/agencies', data),
  updateAgency: (id, data) => api.put(`/admin/agencies/${id}`, data),

  // Niveaux hiérarchiques
  getHierarchyLevels: (agencyId) => api.get(`/admin/agencies/${agencyId}/hierarchy-levels`),
  createHierarchyLevel: (agencyId, data) => api.post(`/admin/agencies/${agencyId}/hierarchy-levels`, data),
  updateHierarchyLevel: (id, data) => api.put(`/admin/hierarchy-levels/${id}`, data),
  deleteHierarchyLevel: (id) => api.delete(`/admin/hierarchy-levels/${id}`),

  // Types de problèmes
  getProblemTypes: (agencyId) => api.get(`/admin/agencies/${agencyId}/problem-types`),
  createProblemType: (agencyId, data) => api.post(`/admin/agencies/${agencyId}/problem-types`, data),
  updateProblemType: (id, data) => api.put(`/admin/problem-types/${id}`, data),

  // Lieux
  getLocations: (agencyId) => api.get(`/admin/agencies/${agencyId}/locations`),
  createLocation: (agencyId, data) => api.post(`/admin/agencies/${agencyId}/locations`, data),
  updateLocation: (id, data) => api.put(`/admin/locations/${id}`, data),

  // SLA
  getSlaConfigs: (agencyId) => api.get(`/admin/agencies/${agencyId}/sla-configs`),
  updateSlaConfig: (id, data) => api.put(`/admin/sla-configs/${id}`, data),

  // Groupes de confidentialité
  getConfidentialityGroups: (agencyId) => api.get(`/admin/agencies/${agencyId}/confidentiality-groups`),
  createConfidentialityGroup: (agencyId, data) => api.post(`/admin/agencies/${agencyId}/confidentiality-groups`, data),
  updateConfidentialityGroup: (id, data) => api.put(`/admin/confidentiality-groups/${id}`, data),

  // Utilisateurs
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  resetPassword: (id, password) => api.put(`/admin/users/${id}/reset-password`, { new_password: password }),

  // Accès agences
  addAgencyAccess: (userId, data) => api.post(`/admin/users/${userId}/agency-access`, data),
  updateAgencyAccess: (id, data) => api.put(`/admin/user-agency-access/${id}`, data),
  deleteAgencyAccess: (id) => api.delete(`/admin/user-agency-access/${id}`),

  // Logs
  getLogs: (params) => api.get('/admin/logs', { params }),

  // Stats globales
  getStats: () => api.get('/admin/stats')
};
