import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUp,
  MessageSquare,
  Eye,
  User,
  FileText,
  Edit,
  Paperclip
} from 'lucide-react';
import { ticketsAPI } from '../services/api';
import clsx from 'clsx';

const ACTION_CONFIG = {
  status_change: {
    icon: Edit,
    color: 'bg-blue-100 text-blue-600',
    getLabel: (h) => `Statut changé: ${h.old_value} → ${h.new_value}`
  },
  urgency_change: {
    icon: AlertTriangle,
    color: 'bg-orange-100 text-orange-600',
    getLabel: (h) => `Urgence changée: ${h.old_value} → ${h.new_value}`
  },
  assignment_change: {
    icon: User,
    color: 'bg-purple-100 text-purple-600',
    getLabel: (h) => 'Responsable modifié'
  },
  escalation: {
    icon: ArrowUp,
    color: 'bg-red-100 text-red-600',
    getLabel: (h) => `Escaladé: Niveau ${h.old_value} → ${h.new_value}`
  },
  visibility_change: {
    icon: Eye,
    color: 'bg-green-100 text-green-600',
    getLabel: (h) => h.new_value === 'true' ? 'Rendu visible au syndicat' : 'Masqué au syndicat'
  },
  comment_added: {
    icon: MessageSquare,
    color: 'bg-gray-100 text-gray-600',
    getLabel: (h) => 'Commentaire ajouté'
  },
  attachment_added: {
    icon: Paperclip,
    color: 'bg-teal-100 text-teal-600',
    getLabel: (h) => {
      const details = h.details ? JSON.parse(h.details) : {};
      return `${details.count || 1} pièce(s) jointe(s) ajoutée(s)`;
    }
  },
  attachment_deleted: {
    icon: Paperclip,
    color: 'bg-red-100 text-red-600',
    getLabel: (h) => 'Pièce jointe supprimée'
  },
  dynamic_responses_updated: {
    icon: FileText,
    color: 'bg-indigo-100 text-indigo-600',
    getLabel: (h) => 'Réponses aux questions mises à jour'
  },
  created: {
    icon: Clock,
    color: 'bg-green-100 text-green-600',
    getLabel: () => 'Ticket créé'
  },
  validated: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-600',
    getLabel: () => 'Ticket validé'
  },
  resolved: {
    icon: CheckCircle,
    color: 'bg-green-100 text-green-600',
    getLabel: () => 'Ticket résolu'
  },
  closed: {
    icon: CheckCircle,
    color: 'bg-gray-100 text-gray-600',
    getLabel: () => 'Ticket clôturé'
  }
};

function TicketTimeline({ ticketId, ticket }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (!ticketId) return;

      setIsLoading(true);
      try {
        const response = await ticketsAPI.getHistory(ticketId);
        setHistory(response.data);
      } catch (error) {
        console.error('Erreur chargement historique:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [ticketId]);

  // Construire la timeline complète avec les événements système
  const buildTimeline = () => {
    const events = [];

    // Événement de création
    if (ticket?.created_at) {
      events.push({
        id: 'created',
        action: 'created',
        created_at: ticket.created_at,
        user_name: ticket.created_by_name
      });
    }

    // Événement de validation
    if (ticket?.validated_at) {
      events.push({
        id: 'validated',
        action: 'validated',
        created_at: ticket.validated_at,
        user_name: ticket.validated_by_name
      });
    }

    // Historique des modifications
    history.forEach(h => {
      events.push({
        ...h,
        user_name: h.user_name || 'Système'
      });
    });

    // Événement de résolution
    if (ticket?.resolved_at) {
      events.push({
        id: 'resolved',
        action: 'resolved',
        created_at: ticket.resolved_at,
        user_name: ticket.resolved_by_name
      });
    }

    // Événement de clôture
    if (ticket?.closed_at) {
      events.push({
        id: 'closed',
        action: 'closed',
        created_at: ticket.closed_at
      });
    }

    // Trier par date
    return events.sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const timeline = buildTimeline();

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Aucun historique disponible
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {timeline.map((event, index) => {
          const config = ACTION_CONFIG[event.action] || {
            icon: Clock,
            color: 'bg-gray-100 text-gray-600',
            getLabel: () => event.action
          };

          const Icon = config.icon;
          const isLast = index === timeline.length - 1;

          return (
            <li key={event.id || index}>
              <div className="relative pb-8">
                {/* Ligne de connexion */}
                {!isLast && (
                  <span
                    className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start space-x-3">
                  {/* Icône */}
                  <div className={clsx(
                    'relative flex h-10 w-10 items-center justify-center rounded-full',
                    config.color
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Contenu */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {config.getLabel(event)}
                      </span>
                      {event.user_name && (
                        <span className="text-gray-500"> par {event.user_name}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {format(new Date(event.created_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>

                    {/* Détails supplémentaires */}
                    {event.details && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                        {typeof event.details === 'string'
                          ? JSON.parse(event.details).files?.join(', ') || event.details
                          : JSON.stringify(event.details)
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TicketTimeline;
