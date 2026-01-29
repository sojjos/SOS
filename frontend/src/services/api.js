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
  toggleUnionVisibility: (id, visible) => api.put(`/tickets/${id}/visibility`, { is_visible_union: visible }),
  getHistory: (id) => api.get(`/tickets/${id}/history`),
  getAttachments: (id) => api.get(`/uploads/ticket/${id}`)
};

export const dashboardAPI = {
  personal: (agencyId) => api.get('/dashboard/personal', { params: { agency_id: agencyId } }),
  team: (agencyId) => api.get('/dashboard/team', { params: { agency_id: agencyId } }),
  site: (agencyId) => api.get('/dashboard/site', { params: { agency_id: agencyId } }),
  direction: (agencyId) => api.get('/dashboard/direction', { params: { agency_id: agencyId } }),
  multiSites: (params) => api.get('/dashboard/multi-sites', { params }),
  analytics: (agencyId, period) => api.get('/dashboard/analytics', { params: { agency_id: agencyId, period } })
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
  getStats: () => api.get('/admin/stats'),

  // Demandes de compte
  getAccountRequests: (params) => api.get('/account-requests', { params }),
  getAccountRequest: (id) => api.get(`/account-requests/${id}`),
  approveRequest: (id, data) => api.post(`/account-requests/${id}/approve`, data),
  rejectRequest: (id, reason) => api.post(`/account-requests/${id}/reject`, { reason }),

  // Questions dynamiques
  getDynamicQuestions: (agencyId) => api.get(`/admin/agencies/${agencyId}/dynamic-questions`),
  createDynamicQuestion: (data) => api.post('/dynamic-questions', data),
  updateDynamicQuestion: (id, data) => api.put(`/dynamic-questions/${id}`, data),
  deleteDynamicQuestion: (id) => api.delete(`/dynamic-questions/${id}`),

  // Permissions d'export
  getExportPermissions: (agencyId) => api.get(`/admin/agencies/${agencyId}/export-permissions`),
  updateExportPermissions: (id, data) => api.put(`/admin/export-permissions/${id}`, data)
};

// Uploads / Pièces jointes
export const uploadsAPI = {
  upload: (formData, config) => api.post('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config
  }),
  getForTicket: (ticketId) => api.get(`/uploads/ticket/${ticketId}`),
  download: (id) => api.get(`/uploads/${id}/download`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/uploads/${id}`)
};

// Questions dynamiques
export const dynamicQuestionsAPI = {
  getForAgency: (agencyId, params) => api.get(`/dynamic-questions/agency/${agencyId}`, { params }),
  getForTicket: (ticketId) => api.get(`/dynamic-questions/ticket/${ticketId}`),
  saveResponses: (ticketId, responses) => api.post(`/dynamic-questions/ticket/${ticketId}/responses`, { responses })
};

// Vue Syndicat
export const unionAPI = {
  getDashboard: (agencyId) => api.get('/union/dashboard', { params: { agency_id: agencyId } }),
  getTickets: (params) => api.get('/union/tickets', { params }),
  getTicket: (id) => api.get(`/union/tickets/${id}`),
  getAgencies: () => api.get('/union/agencies'),
  getComparison: () => api.get('/union/stats/comparison'),
  getFilters: (agencyId) => api.get('/union/filters', { params: { agency_id: agencyId } })
};

// Demandes de compte (public)
export const accountRequestsAPI = {
  create: (data) => api.post('/account-requests', data),
  checkStatus: (email) => api.get(`/account-requests/status/${email}`)
};

// Exports
export const exportsAPI = {
  exportTickets: (data) => api.post('/exports/tickets', data),
  exportStats: (data) => api.post('/exports/stats', data),
  download: (id) => api.get(`/exports/${id}/download`, { responseType: 'blob' }),
  list: () => api.get('/exports')
};

// Agences publiques (pour la demande de compte)
agenciesAPI.listPublic = () => api.get('/agencies/public');

// Templates de tickets
export const templatesAPI = {
  list: (agencyId) => api.get(`/templates/agency/${agencyId}`),
  get: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  adminList: (agencyId) => api.get(`/templates/admin/agency/${agencyId}`)
};
