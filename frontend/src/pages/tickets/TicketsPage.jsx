import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { ticketsAPI, agenciesAPI } from '../../services/api';
import clsx from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentAgency } = useAuthStore();

  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20 });
  const [showFilters, setShowFilters] = useState(false);
  const [problemTypes, setProblemTypes] = useState([]);

  // Filtres
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    urgency: searchParams.get('urgency') || '',
    problem_type_id: searchParams.get('type') || ''
  });

  // Charger les types de problèmes
  useEffect(() => {
    const loadProblemTypes = async () => {
      if (!currentAgency) return;
      try {
        const response = await agenciesAPI.getProblemTypes(currentAgency.id);
        setProblemTypes(response.data);
      } catch (error) {
        console.error('Erreur chargement types de problèmes:', error);
      }
    };
    loadProblemTypes();
  }, [currentAgency]);

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

  // Mettre à jour les filtres
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));

    // Mettre à jour l'URL
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const statusOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'ouvert', label: 'Ouvert' },
    { value: 'en_attente_validation', label: 'En attente validation' },
    { value: 'valide', label: 'Validé' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'resolu', label: 'Résolu' },
    { value: 'cloture', label: 'Clôturé' }
  ];

  const urgencyOptions = [
    { value: '', label: 'Toutes urgences' },
    { value: 'critique', label: 'Critique' },
    { value: 'haute', label: 'Haute' },
    { value: 'moyenne', label: 'Moyenne' },
    { value: 'basse', label: 'Basse' }
  ];

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

      {/* Barre de recherche et filtres */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Recherche */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par référence, titre..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Bouton filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'btn flex items-center gap-2',
              showFilters ? 'btn-primary' : 'btn-secondary'
            )}
          >
            <Filter className="w-5 h-5" />
            Filtres
            <ChevronDown className={clsx('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
          </button>
        </div>

        {/* Filtres dépliables */}
        {showFilters && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t">
            <div>
              <label className="label">Statut</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Urgence</label>
              <select
                value={filters.urgency}
                onChange={(e) => handleFilterChange('urgency', e.target.value)}
                className="input"
              >
                {urgencyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Type de problème</label>
              <select
                value={filters.problem_type_id}
                onChange={(e) => handleFilterChange('problem_type_id', e.target.value)}
                className="input"
              >
                <option value="">Tous les types</option>
                {problemTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilters({ search: '', status: '', urgency: '', problem_type_id: '' });
                  setSearchParams(new URLSearchParams());
                }}
                className="btn btn-secondary w-full"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des tickets */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun ticket trouvé</h3>
          <p className="text-gray-600 mb-4">
            {filters.search || filters.status || filters.urgency || filters.problem_type_id
              ? 'Essayez de modifier vos filtres de recherche'
              : 'Commencez par créer votre premier ticket'}
          </p>
          {!filters.search && !filters.status && !filters.urgency && !filters.problem_type_id && (
            <Link to="/tickets/new" className="btn btn-primary">
              Créer un ticket
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
