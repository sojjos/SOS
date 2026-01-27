import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  Building2,
  Filter
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { unionAPI } from '../../services/api';
import clsx from 'clsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function UnionDashboard() {
  const [agencies, setAgencies] = useState([]);
  const [selectedAgency, setSelectedAgency] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Charger les agences accessibles
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        const response = await unionAPI.getAgencies();
        setAgencies(response.data);
        if (response.data.length > 0) {
          setSelectedAgency(response.data[0].id);
        }
      } catch (error) {
        console.error('Erreur chargement agences:', error);
      }
    };
    loadAgencies();
  }, []);

  // Charger les données du dashboard
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [dashRes, compRes] = await Promise.all([
          unionAPI.getDashboard(selectedAgency || undefined),
          agencies.length > 1 ? unionAPI.getComparison() : null
        ]);

        setDashboardData(dashRes.data);
        if (compRes) setComparisonData(compRes.data);
      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedAgency, agencies.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {};

  // Données pour les graphiques
  const urgencyData = {
    labels: ['Critique', 'Haute', 'Moyenne', 'Basse'],
    datasets: [{
      data: [
        dashboardData?.by_urgency?.critique || 0,
        dashboardData?.by_urgency?.haute || 0,
        dashboardData?.by_urgency?.moyenne || 0,
        dashboardData?.by_urgency?.basse || 0
      ],
      backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745']
    }]
  };

  const typeData = {
    labels: dashboardData?.by_type?.map(t => t.name) || [],
    datasets: [{
      label: 'Tickets',
      data: dashboardData?.by_type?.map(t => t.count) || [],
      backgroundColor: dashboardData?.by_type?.map(t => t.color) || []
    }]
  };

  const trendData = {
    labels: dashboardData?.trends?.map(t => t.period) || [],
    datasets: [{
      label: 'Total',
      data: dashboardData?.trends?.map(t => t.total) || [],
      borderColor: '#2196F3',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      fill: true
    }, {
      label: 'Résolus',
      data: dashboardData?.trends?.map(t => t.resolved) || [],
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true
    }]
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vue Syndicat</h1>
          <p className="text-gray-600">Statistiques et tickets visibles</p>
        </div>

        {/* Sélecteur d'agence */}
        {agencies.length > 1 && (
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-500" />
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="input w-48"
            >
              <option value="">Toutes les agences</option>
              {agencies.map(agency => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx(
              'px-4 py-3 font-medium border-b-2 transition-colors',
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Vue d'ensemble
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={clsx(
              'px-4 py-3 font-medium border-b-2 transition-colors',
              activeTab === 'tickets'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Liste des tickets
          </button>
          {agencies.length > 1 && (
            <button
              onClick={() => setActiveTab('comparison')}
              className={clsx(
                'px-4 py-3 font-medium border-b-2 transition-colors',
                activeTab === 'comparison'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Comparaison
            </button>
          )}
        </nav>
      </div>

      {/* Contenu */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={BarChart3}
              label="Total tickets"
              value={stats.total_tickets || 0}
              color="blue"
            />
            <StatCard
              icon={CheckCircle}
              label="Résolus"
              value={stats.resolved_tickets || 0}
              color="green"
            />
            <StatCard
              icon={AlertTriangle}
              label="Critiques"
              value={stats.critical_tickets || 0}
              color="red"
            />
            <StatCard
              icon={TrendingUp}
              label="Taux SLA"
              value={`${stats.sla_compliance || 0}%`}
              color="purple"
            />
          </div>

          {/* Graphiques */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Par niveau d'urgence</h3>
              <div className="h-64">
                <Doughnut data={urgencyData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Par type de problème</h3>
              <div className="h-64">
                <Bar
                  data={typeData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tendances */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Tendances (6 derniers mois)</h3>
            <div className="h-72">
              <Line
                data={trendData}
                options={{
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } }
                }}
              />
            </div>
          </div>

          {/* Top lieux */}
          {dashboardData?.by_location?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Lieux les plus concernés</h3>
              <div className="space-y-2">
                {dashboardData.by_location.slice(0, 5).map((loc, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                      {i + 1}
                    </span>
                    <span className="flex-1">{loc.name}</span>
                    <span className="font-semibold">{loc.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tickets' && (
        <UnionTicketsList agencyId={selectedAgency} />
      )}

      {activeTab === 'comparison' && comparisonData && (
        <AgencyComparison data={comparisonData} />
      )}
    </div>
  );
}

// Composant liste des tickets syndicat
function UnionTicketsList({ agencyId }) {
  const [tickets, setTickets] = useState([]);
  const [filters, setFilters] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      try {
        const response = await unionAPI.getTickets({
          agency_id: agencyId,
          ...filters,
          page,
          limit: 20
        });
        setTickets(response.data.tickets);
        setTotalPages(response.data.totalPages);
      } catch (error) {
        console.error('Erreur chargement tickets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTickets();
  }, [agencyId, filters, page]);

  const urgencyColors = {
    critique: 'bg-red-100 text-red-800',
    haute: 'bg-orange-100 text-orange-800',
    moyenne: 'bg-yellow-100 text-yellow-800',
    basse: 'bg-green-100 text-green-800'
  };

  const statusLabels = {
    en_analyse: 'En analyse',
    en_cours: 'En cours',
    resolu: 'Résolu',
    cloture: 'Clôturé'
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="card flex flex-wrap gap-4">
        <select
          value={filters.urgency || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, urgency: e.target.value }))}
          className="input w-40"
        >
          <option value="">Toutes urgences</option>
          <option value="critique">Critique</option>
          <option value="haute">Haute</option>
          <option value="moyenne">Moyenne</option>
          <option value="basse">Basse</option>
        </select>

        <select
          value={filters.status || ''}
          onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          className="input w-40"
        >
          <option value="">Tous statuts</option>
          <option value="en_analyse">En analyse</option>
          <option value="en_cours">En cours</option>
          <option value="resolu">Résolu</option>
          <option value="cloture">Clôturé</option>
        </select>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun ticket visible
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(ticket => (
            <Link
              key={ticket.id}
              to={`/union/tickets/${ticket.id}`}
              className="card block hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{ticket.ticket_number}</span>
                    <span className={clsx('badge', urgencyColors[ticket.validated_urgency])}>
                      {ticket.validated_urgency}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
                  <p className="text-sm text-gray-500">
                    {ticket.problem_type_name} • {ticket.location_name}
                  </p>
                </div>
                <div className="text-right">
                  <span className="badge bg-gray-100 text-gray-800">
                    {statusLabels[ticket.status]}
                  </span>
                  {ticket.sla_respected !== null && (
                    <p className={clsx(
                      'text-xs mt-1',
                      ticket.sla_respected ? 'text-green-600' : 'text-red-600'
                    )}>
                      SLA {ticket.sla_respected ? 'respecté' : 'dépassé'}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
          >
            Précédent
          </button>
          <span className="px-4 py-2 text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

// Composant comparaison des agences
function AgencyComparison({ data }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b">
            <th className="pb-3 font-medium">Agence</th>
            <th className="pb-3 font-medium text-center">Total</th>
            <th className="pb-3 font-medium text-center">Résolus</th>
            <th className="pb-3 font-medium text-center">Critiques</th>
            <th className="pb-3 font-medium text-center">Temps moyen</th>
            <th className="pb-3 font-medium text-center">SLA</th>
          </tr>
        </thead>
        <tbody>
          {data.agencies?.map(agency => (
            <tr key={agency.id} className="border-b last:border-0">
              <td className="py-3 font-medium">{agency.name}</td>
              <td className="py-3 text-center">{agency.total_tickets}</td>
              <td className="py-3 text-center">{agency.resolved_tickets}</td>
              <td className="py-3 text-center">
                <span className={clsx(
                  'badge',
                  agency.critical_tickets > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                )}>
                  {agency.critical_tickets}
                </span>
              </td>
              <td className="py-3 text-center">
                {agency.avg_resolution_days ? `${agency.avg_resolution_days}j` : '-'}
              </td>
              <td className="py-3 text-center">
                <span className={clsx(
                  'badge',
                  agency.sla_compliance >= 90 ? 'bg-green-100 text-green-800' :
                  agency.sla_compliance >= 70 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                )}>
                  {agency.sla_compliance || 0}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Composant StatCard
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={clsx('p-3 rounded-lg', colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default UnionDashboard;
