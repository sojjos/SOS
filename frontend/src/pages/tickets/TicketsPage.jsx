import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { ticketsAPI } from '../../services/api';
import AdvancedSearch from '../../components/AdvancedSearch';
import clsx from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentAgency } = useAuthStore();

  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20 });

  // Filtres depuis URL
  const [filters, setFilters] = useState(() => {
    const initial = {};
    searchParams.forEach((value, key) => {
      initial[key] = value;
    });
    return initial;
  });

  // Charger les tickets
  useEffect(() => {
    const loadTickets = async () => {
      if (!currentAgency) return;

      setIsLoading(true);
      try {
        const params = {
          agency_id: currentAgency.id,
          page: pagination.page,
          limit: pagination.limit,
          ...Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v)
          )
        };

        const response = await ticketsAPI.list(params);
        setTickets(response.data.tickets);
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }));
      } catch (error) {
        console.error('Erreur chargement tickets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, [currentAgency, pagination.page, filters]);

  // Gestion de la recherche avancee
  const handleSearch = (searchFilters) => {
    setFilters(searchFilters);
    setPagination(prev => ({ ...prev, page: 1 }));

    // Mettre a jour l'URL
    const newParams = new URLSearchParams();
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value !== '' && value !== false) {
        newParams.set(key, value.toString());
      }
    });
    setSearchParams(newParams);
  };

  if (!currentAgency) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Veuillez sélectionner une agence</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
          <p className="text-gray-600">{pagination.total} ticket(s) au total</p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nouveau ticket
        </Link>
      </div>

      {/* Recherche avancee */}
      <AdvancedSearch
        agencyId={currentAgency.id}
        onSearch={handleSearch}
        initialFilters={filters}
      />

      {/* Liste des tickets */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun ticket trouve</h3>
          <p className="text-gray-600 mb-4">
            {Object.keys(filters).length > 0
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par creer votre premier ticket'}
          </p>
          {Object.keys(filters).length === 0 && (
            <Link to="/tickets/new" className="btn btn-primary">
              Creer un ticket
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn btn-secondary"
              >
                Précédent
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {pagination.page} sur {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="btn btn-secondary"
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TicketCard({ ticket }) {
  const statusConfig = {
    ouvert: { icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Ouvert' },
    en_attente_validation: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', label: 'En attente' },
    valide: { icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Validé' },
    en_cours: { icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'En cours' },
    resolu: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', label: 'Résolu' },
    cloture: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-50', label: 'Clôturé' },
    annule: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', label: 'Annulé' }
  };

  const urgencyColors = {
    critique: 'bg-red-100 text-red-800 border-red-200',
    haute: 'bg-orange-100 text-orange-800 border-orange-200',
    moyenne: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    basse: 'bg-green-100 text-green-800 border-green-200'
  };

  const status = statusConfig[ticket.status] || statusConfig.ouvert;
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="card hover:shadow-md transition-shadow block"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Statut */}
        <div className={clsx('p-2 rounded-lg self-start', status.bg)}>
          <StatusIcon className={clsx('w-5 h-5', status.color)} />
        </div>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
              <p className="text-sm text-gray-500">{ticket.reference}</p>
            </div>
            <span className={clsx('badge border', urgencyColors[ticket.urgency || ticket.proposed_urgency])}>
              {ticket.urgency || ticket.proposed_urgency}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
            {ticket.problem_type_name && (
              <span>{ticket.problem_type_name}</span>
            )}
            {ticket.location_name && (
              <span>{ticket.location_name}</span>
            )}
            <span>
              {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
            </span>
          </div>
        </div>

        {/* SLA indicator */}
        {ticket.sla_status && (
          <div className={clsx(
            'text-xs font-medium px-2 py-1 rounded',
            ticket.sla_status === 'ok' ? 'bg-green-100 text-green-700' :
            ticket.sla_status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          )}>
            SLA {ticket.sla_status === 'ok' ? 'OK' : ticket.sla_status === 'warning' ? 'Attention' : 'Dépassé'}
          </div>
        )}
      </div>
    </Link>
  );
}

export default TicketsPage;
