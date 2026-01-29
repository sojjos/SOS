import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import toast from 'react-hot-toast';

let socket = null;

// Configuration du WebSocket
const SOCKET_URL = window.location.origin;

// Initialiser la connexion WebSocket
export const initWebSocket = () => {
  const { token, user, currentAgency } = useAuthStore.getState();

  if (!token || !user) {
    console.log('WebSocket: Utilisateur non authentifie');
    return;
  }

  // Fermer la connexion existante si elle existe
  if (socket) {
    socket.disconnect();
  }

  // Creer une nouvelle connexion
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

  // Evenements de connexion
  socket.on('connect', () => {
    console.log('WebSocket: Connecte');

    // Rejoindre les salles appropriees
    if (currentAgency) {
      socket.emit('join:agency', currentAgency.id);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('WebSocket: Deconnecte -', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket: Erreur de connexion -', error.message);
  });

  // Evenements de notification
  socket.on('notification', (notification) => {
    // Ajouter au store
    useNotificationStore.getState().addNotification(notification);

    // Afficher un toast
    showNotificationToast(notification);
  });

  // Evenements specifiques aux tickets
  socket.on('ticket:created', (data) => {
    showTicketToast('Nouveau ticket', data.ticket_number, 'created', data.ticket_id);
  });

  socket.on('ticket:status_changed', (data) => {
    const statusLabels = {
      validated: 'valide',
      in_progress: 'en cours',
      escalated: 'escalade',
      resolved: 'resolu',
      closed: 'clos'
    };
    const label = statusLabels[data.new_status] || data.new_status;
    showTicketToast(`Ticket ${label}`, data.ticket_number, data.new_status, data.ticket_id);
  });

  socket.on('ticket:escalated', (data) => {
    showTicketToast('Ticket escalade', data.ticket_number, 'escalated', data.ticket_id);
  });

  socket.on('ticket:comment_added', (data) => {
    showTicketToast('Nouveau commentaire', data.ticket_number, 'comment', data.ticket_id);
  });

  socket.on('ticket:assigned', (data) => {
    showTicketToast('Ticket assigne', data.ticket_number, 'assigned', data.ticket_id);
  });

  socket.on('sla:warning', (data) => {
    showSlaWarningToast(data);
  });

  return socket;
};

// Afficher un toast pour une notification
const showNotificationToast = (notification) => {
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <NotificationIcon type={notification.type} />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-gray-900">{notification.title}</p>
            <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none"
        >
          Fermer
        </button>
      </div>
    </div>
  ), {
    duration: 5000,
    position: 'top-right'
  });
};

// Afficher un toast pour un ticket
const showTicketToast = (title, ticketNumber, type, ticketId) => {
  const colors = {
    created: 'bg-blue-500',
    validated: 'bg-green-500',
    in_progress: 'bg-yellow-500',
    escalated: 'bg-orange-500',
    resolved: 'bg-emerald-500',
    closed: 'bg-gray-500',
    comment: 'bg-purple-500',
    assigned: 'bg-indigo-500'
  };

  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex overflow-hidden`}
      onClick={() => {
        window.location.href = `/tickets/${ticketId}`;
        toast.dismiss(t.id);
      }}
    >
      <div className={`w-2 ${colors[type] || 'bg-gray-500'}`} />
      <div className="flex-1 p-4 cursor-pointer">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <span className="text-xs text-gray-500">maintenant</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">Ticket #{ticketNumber}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(t.id);
        }}
        className="px-4 text-gray-400 hover:text-gray-600"
      >
        &times;
      </button>
    </div>
  ), {
    duration: 6000,
    position: 'top-right'
  });
};

// Afficher un toast pour un avertissement SLA
const showSlaWarningToast = (data) => {
  toast.custom((t) => (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-red-50 border-l-4 border-red-500 shadow-lg rounded-lg pointer-events-auto flex`}
      onClick={() => {
        window.location.href = `/tickets/${data.ticket_id}`;
        toast.dismiss(t.id);
      }}
    >
      <div className="flex-1 p-4 cursor-pointer">
        <div className="flex items-center">
          <span className="text-red-500 text-lg mr-2">!</span>
          <p className="text-sm font-semibold text-red-800">Alerte SLA</p>
        </div>
        <p className="mt-1 text-sm text-red-700">
          Ticket #{data.ticket_number} - {data.time_remaining} restant
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(t.id);
        }}
        className="px-4 text-red-400 hover:text-red-600"
      >
        &times;
      </button>
    </div>
  ), {
    duration: 10000,
    position: 'top-right'
  });
};

// Icone pour les notifications
const NotificationIcon = ({ type }) => {
  const icons = {
    ticket_created: '🎫',
    ticket_validated: '✅',
    ticket_escalated: '⬆️',
    ticket_resolved: '🎉',
    ticket_closed: '📁',
    comment_added: '💬',
    assigned: '👤',
    sla_warning: '⚠️'
  };

  return (
    <span className="text-xl">{icons[type] || '📣'}</span>
  );
};

// Rejoindre une salle de ticket specifique
export const joinTicketRoom = (ticketId) => {
  if (socket?.connected) {
    socket.emit('join:ticket', ticketId);
  }
};

// Quitter une salle de ticket
export const leaveTicketRoom = (ticketId) => {
  if (socket?.connected) {
    socket.emit('leave:ticket', ticketId);
  }
};

// Changer d'agence
export const switchAgencyRoom = (newAgencyId) => {
  if (socket?.connected) {
    const { currentAgency } = useAuthStore.getState();
    if (currentAgency) {
      socket.emit('leave:agency', currentAgency.id);
    }
    socket.emit('join:agency', newAgencyId);
  }
};

// Deconnecter le WebSocket
export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Obtenir l'instance du socket
export const getSocket = () => socket;

export default {
  initWebSocket,
  disconnectWebSocket,
  joinTicketRoom,
  leaveTicketRoom,
  switchAgencyRoom,
  getSocket
};
