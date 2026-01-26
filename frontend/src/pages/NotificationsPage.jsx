import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, Clock, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useNotificationStore from '../store/notificationStore';
import clsx from 'clsx';

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationStore();

  const [filter, setFilter] = useState('all'); // all, unread

  useEffect(() => {
    fetchNotifications({ unread_only: filter === 'unread' });
  }, [fetchNotifications, filter]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'ticket_created':
      case 'ticket_assigned':
      case 'ticket_updated':
        return Ticket;
      case 'sla_warning':
      case 'sla_breach':
        return Clock;
      default:
        return Bell;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'ticket_created':
        return 'bg-blue-100 text-blue-600';
      case 'ticket_assigned':
        return 'bg-purple-100 text-purple-600';
      case 'sla_warning':
        return 'bg-yellow-100 text-yellow-600';
      case 'sla_breach':
        return 'bg-red-100 text-red-600';
      case 'ticket_resolved':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">
            {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Tout est lu'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-secondary flex items-center gap-2"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'all'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Toutes
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={clsx(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            filter === 'unread'
              ? 'bg-primary-100 text-primary-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          Non lues
        </button>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-12">
          <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucune notification
          </h3>
          <p className="text-gray-600">
            {filter === 'unread'
              ? 'Vous avez lu toutes vos notifications'
              : 'Vous n\'avez pas encore de notifications'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const Icon = getNotificationIcon(notif.type);
            const iconColor = getNotificationColor(notif.type);

            return (
              <div
                key={notif.id}
                className={clsx(
                  'card flex gap-4 transition-colors',
                  !notif.is_read && 'bg-primary-50 border-primary-200'
                )}
              >
                <div className={clsx('p-2 rounded-lg self-start', iconColor)}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={clsx(
                        'font-medium',
                        notif.is_read ? 'text-gray-700' : 'text-gray-900'
                      )}>
                        {notif.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notif.message}
                      </p>
                      {notif.ticket_reference && (
                        <Link
                          to={`/tickets/${notif.ticket_id}`}
                          className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block"
                        >
                          {notif.ticket_reference} - {notif.ticket_title}
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(notif.created_at), 'dd MMM HH:mm', { locale: fr })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Marquer comme lu
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;
