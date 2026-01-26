import { create } from 'zustand';
import api from '../services/api';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  // Charger les notifications
  fetchNotifications: async (options = {}) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (options.unread_only) params.append('unread_only', 'true');
      if (options.limit) params.append('limit', options.limit);

      const response = await api.get(`/notifications?${params}`);
      set({
        notifications: response.data.notifications,
        unreadCount: response.data.unread_count,
        isLoading: false
      });
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      set({ isLoading: false });
    }
  },

  // Récupérer le compteur de non-lues
  fetchUnreadCount: async () => {
    try {
      const response = await api.get('/notifications/count');
      set({ unreadCount: response.data.unread_count });
    } catch (error) {
      console.error('Erreur compteur notifications:', error);
    }
  },

  // Marquer comme lue
  markAsRead: async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Erreur marquage notification:', error);
    }
  },

  // Marquer toutes comme lues
  markAllAsRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set((state) => ({
        notifications: state.notifications.map(n => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString()
        })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Erreur marquage notifications:', error);
    }
  },

  // Supprimer une notification
  deleteNotification: async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== notificationId)
      }));
    } catch (error) {
      console.error('Erreur suppression notification:', error);
    }
  },

  // Ajouter une notification locale (pour temps réel)
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));
  }
}));

export default useNotificationStore;
