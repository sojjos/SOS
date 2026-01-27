import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';

export function useWebSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token, isAuthenticated } = useAuthStore();
  const { addNotification, fetchUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Créer la connexion WebSocket
    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 WebSocket connecté');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket déconnecté:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Erreur WebSocket:', error.message);
      setIsConnected(false);
    });

    // Écouter les notifications
    socket.on('notification', (notification) => {
      addNotification(notification);

      // Afficher un toast
      toast(notification.title, {
        icon: '🔔',
        duration: 5000,
      });
    });

    // Écouter le compteur de notifications
    socket.on('unread_count', ({ count }) => {
      // Le store sera mis à jour automatiquement
    });

    // Écouter les mises à jour de tickets
    socket.on('ticket_created', (data) => {
      toast(`Nouveau ticket: ${data.title}`, { icon: '🎫' });
    });

    socket.on('ticket_updated', (data) => {
      // Peut être utilisé pour mettre à jour le ticket en temps réel
      window.dispatchEvent(new CustomEvent('ticket_updated', { detail: data }));
    });

    socket.on('new_comment', (data) => {
      window.dispatchEvent(new CustomEvent('new_comment', { detail: data }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, token, addNotification]);

  // Rejoindre un canal de ticket
  const joinTicket = useCallback((ticketId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_ticket', ticketId);
    }
  }, []);

  // Quitter un canal de ticket
  const leaveTicket = useCallback((ticketId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_ticket', ticketId);
    }
  }, []);

  // Marquer une notification comme lue
  const markNotificationRead = useCallback((notificationId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('mark_notification_read', notificationId);
    }
  }, []);

  return {
    isConnected,
    joinTicket,
    leaveTicket,
    markNotificationRead,
  };
}

export default useWebSocket;
