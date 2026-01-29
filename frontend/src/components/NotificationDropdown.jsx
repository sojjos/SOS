import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import useNotificationStore from '../store/notificationStore';
import clsx from 'clsx';

function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationStore();

  // Charger les notifications quand le dropdown s'ouvre
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ limit: 10 });
    }
  }, [isOpen, fetchNotifications]);

  // Fermer le dropdown en cliquant dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = (type) => {
    const icons = {
      ticket_created: { icon: '🎫', bg: 'bg-blue-100', text: 'text-blue-600' },
      ticket_validated: { icon: '✅', bg: 'bg-green-100', text: 'text-green-600' },
      ticket_escalated: { icon: '⬆️', bg: 'bg-orange-100', text: 'text-orange-600' },
      ticket_resolved: { icon: '🎉', bg: 'bg-emerald-100', text: 'text-emerald-600' },
      ticket_closed: { icon: '📁', bg: 'bg-gray-100', text: 'text-gray-600' },
      comment_added: { icon: '💬', bg: 'bg-purple-100', text: 'text-purple-600' },
      assigned: { icon: '👤', bg: 'bg-indigo-100', text: 'text-indigo-600' },
      sla_warning: { icon: '⚠️', bg: 'bg-red-100', text: 'text-red-600' },
      mention: { icon: '@', bg: 'bg-cyan-100', text: 'text-cyan-600' }
    };
    return icons[type] || { icon: '📣', bg: 'bg-gray-100', text: 'text-gray-600' };
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton de notification */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Aucune notification</p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((notification) => {
                  const iconStyle = getNotificationIcon(notification.type);
                  return (
                    <li
                      key={notification.id}
                      className={clsx(
                        'p-4 hover:bg-gray-50 transition-colors cursor-pointer',
                        !notification.is_read && 'bg-blue-50/50'
                      )}
                    >
                      <div className="flex gap-3">
                        {/* Icone */}
                        <div className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                          iconStyle.bg
                        )}>
                          <span className="text-lg">{iconStyle.icon}</span>
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <Link
                            to={notification.link || `/tickets/${notification.ticket_id}`}
                            onClick={() => handleNotificationClick(notification)}
                            className="block"
                          >
                            <p className={clsx(
                              'text-sm',
                              !notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: fr
                              })}
                            </p>
                          </Link>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1">
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-green-600"
                              title="Marquer comme lu"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-red-600"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Voir toutes les notifications
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
