import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  BarChart3,
  PieChart
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
import useAuthStore from '../store/authStore';
import { dashboardAPI } from '../services/api';
import clsx from 'clsx';

// Enregistrer les composants Chart.js
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

function DashboardPage() {
  const { currentAgency, getCurrentLevel, hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState('personal');
  const [personalData, setPersonalData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [siteData, setSiteData] = useState(null);
  const [directionData, setDirectionData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentLevel = getCurrentLevel();

  // Définir les onglets disponibles selon le niveau
  const tabs = [
    { id: 'personal', label: 'Personnel', icon: Ticket, minLevel: 0 },
    { id: 'team', label: 'Équipe', icon: Users, minLevel: 1 },
    { id: 'site', label: 'Site', icon: BarChart3, minLevel: 2 },
    { id: 'direction', label: 'Direction', icon: PieChart, minLevel: 2 },
  ].filter(tab => currentLevel >= tab.minLevel);

  // Charger les données du dashboard
  useEffect(() => {
    const loadData = async () => {
      if (!currentAgency) return;

      setIsLoading(true);
      try {
        // Charger les données personnelles (toujours disponibles)
        const personalRes = await dashboardAPI.personal(currentAgency.id);
        setPersonalData(personalRes.data);

        // Charger les données équipe si niveau >= 1
        if (currentLevel >= 1) {
          const teamRes = await dashboardAPI.team(currentAgency.id);
          setTeamData(teamRes.data);
        }

        // Charger les données site si niveau >= 2
        if (currentLevel >= 2) {
          const siteRes = await dashboardAPI.site(currentAgency.id);
          setSiteData(siteRes.data);

          const directionRes = await dashboardAPI.direction(currentAgency.id);
          setDirectionData(directionRes.data);
        }
      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentAgency, currentLevel]);

  if (!currentAgency) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Veuillez sélectionner une agence</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">{currentAgency.name}</p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          + Nouveau ticket
        </Link>
      </div>

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'personal' && personalData && (
        <PersonalDashboard data={personalData} />
      )}
      {activeTab === 'team' && teamData && (
        <TeamDashboard data={teamData} />
      )}
      {activeTab === 'site' && siteData && (
        <SiteDashboard data={siteData} />
      )}
      {activeTab === 'direction' && directionData && (
        <DirectionDashboard data={directionData} />
      )}
    </div>
  );
}

// Dashboard Personnel
function PersonalDashboard({ data }) {
  const stats = data.stats;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Ticket}
          label="Mes tickets"
          value={stats.my_tickets_total}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="En cours"
          value={stats.my_tickets_in_progress}
          color="yellow"
        />
        <StatCard
          icon={CheckCircle}
          label="Résolus"
          value={stats.my_tickets_resolved}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="SLA en danger"
          value={stats.my_tickets_sla_warning}
          color="red"
        />
      </div>

      {/* Mes tickets récents */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-semibold text-gray-900">Mes tickets récents</h3>
          <Link to="/tickets" className="text-sm text-primary-600 hover:text-primary-700">
            Voir tous
          </Link>
        </div>
        {data.recent_tickets?.length > 0 ? (
          <div className="divide-y">
            {data.recent_tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Aucun ticket</p>
        )}
      </div>
    </div>
  );
}

// Dashboard Équipe
function TeamDashboard({ data }) {
  const stats = data.stats;

  const statusData = {
    labels: ['En attente', 'En cours', 'Résolus', 'Clôturés'],
    datasets: [{
      data: [
        stats.team_pending || 0,
        stats.team_in_progress || 0,
        stats.team_resolved || 0,
        stats.team_closed || 0
      ],
      backgroundColor: ['#FF9800', '#2196F3', '#4CAF50', '#607D8B']
    }]
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Ticket}
          label="Tickets équipe"
          value={stats.team_total}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="À valider"
          value={stats.team_pending_validation}
          color="orange"
        />
        <StatCard
          icon={TrendingUp}
          label="Taux résolution"
          value={`${stats.resolution_rate || 0}%`}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="SLA dépassés"
          value={stats.team_sla_breach}
          color="red"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Graphique statuts */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Répartition par statut</h3>
          <div className="h-64">
            <Doughnut data={statusData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>

        {/* Tickets en attente de validation */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">En attente de validation</h3>
          {data.pending_validation?.length > 0 ? (
            <div className="divide-y max-h-64 overflow-y-auto">
              {data.pending_validation.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} compact />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Aucun ticket en attente</p>
          )}
        </div>
      </div>

      {/* Performance équipe */}
      {data.team_performance && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Performance de l'équipe</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">Membre</th>
                  <th className="pb-2 text-center">Tickets</th>
                  <th className="pb-2 text-center">Résolus</th>
                  <th className="pb-2 text-center">Taux</th>
                </tr>
              </thead>
              <tbody>
                {data.team_performance.map((member) => (
                  <tr key={member.user_id} className="border-b last:border-0">
                    <td className="py-3">{member.first_name} {member.last_name}</td>
                    <td className="py-3 text-center">{member.tickets_count}</td>
                    <td className="py-3 text-center">{member.resolved_count}</td>
                    <td className="py-3 text-center">
                      <span className={clsx(
                        'badge',
                        member.resolution_rate >= 80 ? 'bg-green-100 text-green-800' :
                        member.resolution_rate >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      )}>
                        {member.resolution_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard Site
function SiteDashboard({ data }) {
  const stats = data.stats;

  const urgencyData = {
    labels: ['Critique', 'Haute', 'Moyenne', 'Basse'],
    datasets: [{
      label: 'Tickets',
      data: [
        data.by_urgency?.critique || 0,
        data.by_urgency?.haute || 0,
        data.by_urgency?.moyenne || 0,
        data.by_urgency?.basse || 0
      ],
      backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745']
    }]
  };

  const typeLabels = data.by_type?.map(t => t.name) || [];
  const typeData = {
    labels: typeLabels,
    datasets: [{
      label: 'Tickets',
      data: data.by_type?.map(t => t.count) || [],
      backgroundColor: data.by_type?.map(t => t.color) || []
    }]
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Ticket}
          label="Total tickets"
          value={stats.site_total}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Temps moyen"
          value={`${stats.avg_resolution_time || 0}h`}
          color="purple"
        />
        <StatCard
          icon={CheckCircle}
          label="Taux SLA"
          value={`${stats.sla_compliance || 0}%`}
          color="green"
        />
        <StatCard
          icon={AlertTriangle}
          label="Critiques actifs"
          value={stats.critical_active}
          color="red"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Par urgence */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Par niveau d'urgence</h3>
          <div className="h-64">
            <Bar
              data={urgencyData}
              options={{
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
              }}
            />
          </div>
        </div>

        {/* Par type */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Par type de problème</h3>
          <div className="h-64">
            <Doughnut data={typeData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Top lieux problématiques */}
      {data.top_locations && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Lieux les plus concernés</h3>
          <div className="space-y-3">
            {data.top_locations.map((loc, index) => (
              <div key={loc.location_id} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="flex-1">{loc.location_name}</span>
                <span className="font-semibold">{loc.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Dashboard Direction
function DirectionDashboard({ data }) {
  const trendLabels = data.trends?.map(t => t.period) || [];
  const trendData = {
    labels: trendLabels,
    datasets: [{
      label: 'Nouveaux',
      data: data.trends?.map(t => t.created) || [],
      borderColor: '#2196F3',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      fill: true
    }, {
      label: 'Résolus',
      data: data.trends?.map(t => t.resolved) || [],
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true
    }]
  };

  return (
    <div className="space-y-6">
      {/* Tendances */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Tendances (30 derniers jours)</h3>
        <div className="h-72">
          <Line
            data={trendData}
            options={{
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true }
              }
            }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Performance par responsable */}
        {data.by_responsible && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Par responsable</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.by_responsible.map((resp) => (
                <div key={resp.user_id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <span>{resp.first_name} {resp.last_name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">{resp.total} tickets</span>
                    <span className={clsx(
                      'badge',
                      resp.sla_rate >= 90 ? 'bg-green-100 text-green-800' :
                      resp.sla_rate >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    )}>
                      {resp.sla_rate}% SLA
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analyse Pareto */}
        {data.pareto && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Analyse Pareto - Causes principales</h3>
            <div className="space-y-2">
              {data.pareto.slice(0, 5).map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.name}</span>
                      <span>{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Composants utilitaires
function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
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

function TicketRow({ ticket, compact = false }) {
  const urgencyColors = {
    critique: 'badge-critique',
    haute: 'badge-haute',
    moyenne: 'badge-moyenne',
    basse: 'badge-basse'
  };

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block py-3 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{ticket.title}</p>
          {!compact && (
            <p className="text-sm text-gray-500">{ticket.reference}</p>
          )}
        </div>
        <span className={clsx('badge', urgencyColors[ticket.urgency])}>
          {ticket.urgency}
        </span>
      </div>
    </Link>
  );
}

export default DashboardPage;
