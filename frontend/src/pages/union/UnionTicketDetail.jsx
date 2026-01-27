import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Tag,
  Building2,
  TrendingUp
} from 'lucide-react';
import { unionAPI } from '../../services/api';
import clsx from 'clsx';

function UnionTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadTicket = async () => {
      setIsLoading(true);
      try {
        const response = await unionAPI.getTicket(id);
        setTicket(response.data);
      } catch (err) {
        console.error('Erreur chargement ticket:', err);
        setError(err.response?.data?.error || 'Ticket non trouvé');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={() => navigate('/union')} className="btn btn-primary">
          Retour au dashboard
        </button>
      </div>
    );
  }

  const urgencyColors = {
    critique: 'bg-red-100 text-red-800 border-red-200',
    haute: 'bg-orange-100 text-orange-800 border-orange-200',
    moyenne: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    basse: 'bg-green-100 text-green-800 border-green-200'
  };

  const statusLabels = {
    en_analyse: 'En analyse',
    en_cours: 'En cours',
    resolu: 'Résolu',
    cloture: 'Clôturé'
  };

  const statusColors = {
    en_analyse: 'bg-blue-100 text-blue-800',
    en_cours: 'bg-purple-100 text-purple-800',
    resolu: 'bg-green-100 text-green-800',
    cloture: 'bg-gray-100 text-gray-800'
  };

  const actionLabels = {
    status_change: 'Changement de statut',
    urgency_change: 'Changement d\'urgence',
    escalation: 'Escalade'
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/union')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Ticket #{ticket.ticket_number}</span>
            <span>•</span>
            <span>{ticket.agency_name}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
        </div>
      </div>

      {/* Badges principaux */}
      <div className="flex flex-wrap gap-2">
        <span className={clsx('badge border', urgencyColors[ticket.validated_urgency])}>
          Urgence: {ticket.validated_urgency}
        </span>
        <span className={clsx('badge', statusColors[ticket.status])}>
          {statusLabels[ticket.status]}
        </span>
        {ticket.validated_blocking && (
          <span className="badge bg-gray-100 text-gray-800">
            {ticket.validated_blocking === 'bloquant' ? 'Bloquant' :
             ticket.validated_blocking === 'partiel' ? 'Partiellement bloquant' : 'Non bloquant'}
          </span>
        )}
        {ticket.sla_respected !== null && (
          <span className={clsx(
            'badge',
            ticket.sla_respected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          )}>
            SLA {ticket.sla_respected ? 'respecté' : 'dépassé'}
          </span>
        )}
      </div>

      {/* Informations */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Informations</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Type de problème</p>
                <p className="font-medium">{ticket.problem_type_name || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Lieu</p>
                <p className="font-medium">{ticket.location_name || '-'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Agence</p>
                <p className="font-medium">{ticket.agency_name}</p>
              </div>
            </div>

            {ticket.recurrence && (
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Récurrence</p>
                  <p className="font-medium capitalize">{ticket.recurrence}</p>
                </div>
              </div>
            )}

            {ticket.has_workaround && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">Solution de contournement disponible</p>
              </div>
            )}

            {ticket.resolution_type && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  Résolution {ticket.resolution_type === 'permanente' ? 'permanente' : 'temporaire'}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Dates</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Créé le</p>
                <p className="font-medium">
                  {new Date(ticket.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {ticket.validated_at && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Validé le</p>
                  <p className="font-medium">
                    {new Date(ticket.validated_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}

            {ticket.resolved_at && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Résolu le</p>
                  <p className="font-medium">
                    {new Date(ticket.resolved_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}

            {ticket.sla_resolution_deadline && (
              <div className={clsx(
                'p-3 rounded-lg',
                ticket.sla_respected === false ? 'bg-red-50' : 'bg-gray-50'
              )}>
                <p className="text-sm text-gray-500">Échéance SLA</p>
                <p className={clsx(
                  'font-medium',
                  ticket.sla_respected === false ? 'text-red-800' : 'text-gray-900'
                )}>
                  {new Date(ticket.sla_resolution_deadline).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historique */}
      {ticket.history && ticket.history.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Historique</h2>
          <div className="space-y-3">
            {ticket.history.map((event, i) => (
              <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {actionLabels[event.action] || event.action}
                  </p>
                  {event.old_value && event.new_value && (
                    <p className="text-sm text-gray-500">
                      {event.old_value} → {event.new_value}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(event.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="card bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-800">
          <strong>Note :</strong> Cette vue syndicale affiche des informations limitées.
          Les descriptions détaillées et les noms des personnes impliquées ne sont pas visibles.
        </p>
      </div>
    </div>
  );
}

export default UnionTicketDetail;
