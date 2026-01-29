import { create } from 'zustand';
import { platformAuthAPI } from '../services/platformApi';

const usePlatformStore = create((set, get) => ({
  // State
  admin: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  // Actions
  initialize: async () => {
    const token = localStorage.getItem('platformToken');
    const refreshToken = localStorage.getItem('platformRefreshToken');
    const adminData = localStorage.getItem('platformAdmin');

    if (!token || !adminData) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      // Valider le token avec le serveur
      const admin = await platformAuthAPI.me();
      set({
        admin,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token invalide, essayer de rafraîchir
      if (refreshToken) {
        try {
          const { token: newToken } = await platformAuthAPI.refresh(refreshToken);
          localStorage.setItem('platformToken', newToken);
          const admin = await platformAuthAPI.me();
          set({
            admin,
            token: newToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (refreshError) {
          // Échec du rafraîchissement
          get().logout();
        }
      } else {
        get().logout();
      }
    }
  },

  login: async (email, password) => {
    try {
      const response = await platformAuthAPI.login(email, password);

      localStorage.setItem('platformToken', response.token);
      localStorage.setItem('platformRefreshToken', response.refreshToken);
      localStorage.setItem('platformAdmin', JSON.stringify(response.admin));

      set({
        admin: response.admin,
        token: response.token,
        refreshToken: response.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erreur de connexion',
      };
    }
  },

  logout: async () => {
    try {
      await platformAuthAPI.logout();
    } catch (error) {
      // Ignorer l'erreur
    }

    localStorage.removeItem('platformToken');
    localStorage.removeItem('platformRefreshToken');
    localStorage.removeItem('platformAdmin');

    set({
      admin: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  updateAdmin: (adminData) => {
    set({ admin: { ...get().admin, ...adminData } });
    localStorage.setItem('platformAdmin', JSON.stringify(get().admin));
  },

  // Helpers
  isSuperAdmin: () => {
    return get().admin?.role === 'super_admin';
  },

  isAdmin: () => {
    const role = get().admin?.role;
    return role === 'super_admin' || role === 'admin';
  },

  canManageAdmins: () => {
    return get().admin?.role === 'super_admin';
  },
}));

export default usePlatformStore;
