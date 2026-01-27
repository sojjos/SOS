import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      currentAgency: null,
      adminMode: false, // true = mode admin, false = mode agence

      // Login
      login: async (email, password) => {
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token, refreshToken } = response.data;

          set({
            user,
            token,
            refreshToken,
            isAuthenticated: true,
            isLoading: false
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Erreur de connexion'
          };
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          currentAgency: null,
          adminMode: false
        });
        delete api.defaults.headers.common['Authorization'];
      },

      // Refresh token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          return false;
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken });
          const { token, refreshToken: newRefreshToken, user } = response.data;

          set({
            token,
            refreshToken: newRefreshToken,
            user
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          return true;
        } catch (error) {
          get().logout();
          return false;
        }
      },

      // Définir l'agence courante
      setCurrentAgency: (agency) => {
        set({ currentAgency: agency });
      },

      // Basculer entre mode admin et mode agence
      toggleAdminMode: () => {
        set((state) => ({ adminMode: !state.adminMode }));
      },

      // Vérifier si l'utilisateur est admin
      isAdmin: () => {
        const { user } = get();
        return user?.account_type === 'admin' || user?.account_type === 'admin_delegated';
      },

      // Vérifier si l'utilisateur est admin complet
      isFullAdmin: () => {
        const { user } = get();
        return user?.account_type === 'admin';
      },

      // Vérifier si l'utilisateur est membre du syndicat
      isUnionMember: () => {
        const { user } = get();
        if (!user) return false;
        return user.agency_accesses?.some(a => a.is_union_member === true) || false;
      },

      // Obtenir le niveau hiérarchique pour l'agence courante
      getCurrentLevel: () => {
        const { user, currentAgency, adminMode } = get();
        if (!user || !currentAgency) return null;

        // En mode admin, niveau max
        if (adminMode && (user.account_type === 'admin' || user.account_type === 'admin_delegated')) {
          return 999;
        }

        // Sinon, chercher l'accès à l'agence
        const access = user.agency_accesses?.find(a => a.agency_id === currentAgency.id);
        return access?.level_number ?? null;
      },

      // Vérifier une permission
      hasPermission: (permission) => {
        const { user, currentAgency, adminMode } = get();
        if (!user) return false;

        // Admins ont toutes les permissions
        if (user.account_type === 'admin' || user.account_type === 'admin_delegated') {
          return true;
        }

        if (!currentAgency) return false;

        const access = user.agency_accesses?.find(a => a.agency_id === currentAgency.id);
        if (!access) return false;

        const permissions = access.permissions || {};
        return permissions.all || permissions[permission] || false;
      },

      // Initialiser l'authentification au chargement
      initialize: async () => {
        const { token, refreshAccessToken } = get();

        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Vérifier que le token est valide
          try {
            const response = await api.get('/auth/me');
            set({ user: response.data.user, isLoading: false });
          } catch (error) {
            // Token invalide, essayer de rafraîchir
            const refreshed = await refreshAccessToken();
            if (!refreshed) {
              set({ isLoading: false });
            }
          }
        } else {
          set({ isLoading: false });
        }
      },

      // Mettre à jour le profil utilisateur
      updateProfile: async (data) => {
        try {
          const response = await api.put('/auth/profile', data);
          set({ user: response.data.user });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Erreur lors de la mise à jour'
          };
        }
      },

      // Changer le mot de passe
      changePassword: async (currentPassword, newPassword) => {
        try {
          await api.put('/auth/password', { currentPassword, newPassword });
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Erreur lors du changement de mot de passe'
          };
        }
      }
    }),
    {
      name: 'sos-auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        currentAgency: state.currentAgency
      })
    }
  )
);

export default useAuthStore;
