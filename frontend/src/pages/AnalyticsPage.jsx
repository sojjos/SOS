import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Target
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import useAuthStore from '../store/authStore';
import { dashboardAPI } from '../services/api';
import clsx from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function AnalyticsPage() {
  const { currentAgency, getCurrentLevel } = useAuthStore();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  const currentLevel = getCurrentLevel();

  useEffect(() => {
    loadAnalytics();
  }, [currentAgency, period]);

  const loadAnalytics = async () => {
    if (!currentAgency) return;

    setIsLoading(true);
    try {
      const response = await dashboardAPI.analytics(currentAgency.id, period);
      setData(response.data);
    } catch (error) {
      console.error('Erreur chargement analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentAgency) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Veuillez selectionner une agence</p>
      </div>
    );
  }

  if (currentLevel < 2) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Acces restreint</h2>
        <p className="text-gray-600">Les analytics avances sont reserves aux niveaux 2 et superieurs.</p>
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

  const { kpis, dailyTrend, slaByType, slowestTickets, hourlyDistribution } = data || {};

  // Preparer les donnees du graphique de tendance
  const trendChartData = {
    labels: dailyTrend?.map(d => format(new Date(d.date), 'dd/MM', { locale: fr })) || [],
    datasets: [
      {
        label: 'Crees',
        data: dailyTrend?.map(d => d.created) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
      },
      {
        label: 'Resolus',
        data: dailyTrend?.map(d => d.resolved) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3
      }
    ]
  };

  // Preparer les donnees du graphique SLA par type
  const slaChartData = {
    labels: slaByType?.map(t => t.name) || [],
    datasets: [
      {
        label: 'Taux SLA (%)',
        data: slaByType?.map(t => t.sla_rate || 0) || [],
        backgroundColor: slaByType?.map(t => t.color || '#6b7280') || [],
        borderRadius: 4
      }
    ]
  };

  // Preparer la heatmap
  const heatmapData = buildHeatmap(hourlyDistribution);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600">{currentAgency.name}</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input w-auto"
        >
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
          <option value="365">12 derniers mois</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={BarChart3}
          label="Tickets crees"
          value={kpis?.total_created || 0}
          change={kpis?.changes?.created}
          color="blue"
        />
        <KPICard
          icon={CheckCircle}
          label="Tickets resolus"
          value={kpis?.total_resolved || 0}
          change={kpis?.changes?.resolved}
          color="green"
        />
        <KPICard
          icon={Clock}
          label="Temps moyen resolution"
          value={`${kpis?.avg_resolution_hours || 0}h`}
          change={kpis?.changes?.resolution_time}
          invertChange
          color="purple"
        />
        <KPICard
          icon={Target}
          label="Conformite SLA"
          value={`${kpis?.sla_compliance || 0}%`}
          change={kpis?.changes?.sla}
          color="emerald"
        />
      </div>

      {/* Graphiques principaux */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Evolution quotidienne */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Evolution quotidienne</h3>
          <div className="h-72">
            <Line
              data={trendChartData}
              options={{
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true }
                },
                plugins: {
                  legend: { position: 'bottom' }
                }
              }}
            />
          </div>
        </div>

        {/* Performance SLA par type */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Conformite SLA par type</h3>
          <div className="h-72">
            <Bar
              data={slaChartData}
              options={{
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                  x: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { callback: (v) => `${v}%` }
                  }
                },
                plugins: {
                  legend: { display: false }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Heatmap et Tickets lents */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Heatmap horaire */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Distribution horaire des tickets</h3>
          <HeatmapChart data={heatmapData} />
        </div>

        {/* Tickets les plus lents */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Tickets les plus longs a resoudre</h3>
          <div className="space-y-3">
            {slowestTickets?.map((ticket, index) => (
              <a
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    #{ticket.ticket_number} - {ticket.title}
                  </p>
                  <p className="text-sm text-gray-500">{ticket.problem_type}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">{ticket.hours_to_resolve}h</p>
                  <span className={clsx(
                    'text-xs px-2 py-0.5 rounded',
                    ticket.urgency === 'critique' ? 'bg-red-100 text-red-700' :
                    ticket.urgency === 'haute' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  )}>
                    {ticket.urgency}
                  </span>
                </div>
              </a>
            ))}
            {(!slowestTickets || slowestTickets.length === 0) && (
              <p className="text-gray-500 text-center py-4">Aucun ticket resolu sur cette periode</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats supplementaires */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{kpis?.critical_count || 0}</p>
          <p className="text-sm text-gray-600">Tickets critiques</p>
        </div>
        <div className="card text-center">
          <ArrowUpRight className="w-8 h-8 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{kpis?.escalation_rate || 0}%</p>
          <p className="text-sm text-gray-600">Taux d'escalade</p>
        </div>
        <div className="card text-center">
          <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {kpis?.total_created > 0
              ? Math.round((kpis.total_resolved / kpis.total_created) * 100)
              : 0}%
          </p>
          <p className="text-sm text-gray-600">Taux de resolution</p>
        </div>
      </div>
    </div>
  );
}

// Composant KPI avec variation
function KPICard({ icon: Icon, label, value, change, invertChange = false, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600'
  };

  const isPositive = invertChange ? change < 0 : change > 0;
  const isNegative = invertChange ? change > 0 : change < 0;

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== null && change !== undefined && (
          <span className={clsx(
            'flex items-center text-xs font-medium',
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
          )}>
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </div>
  );
}

// Construire les donnees de la heatmap
function buildHeatmap(hourlyDistribution) {
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Initialiser la matrice
  const matrix = days.map(() => hours.map(() => 0));

  // Remplir avec les donnees
  hourlyDistribution?.forEach(item => {
    matrix[item.day_of_week][item.hour] = parseInt(item.count);
  });

  // Trouver le max pour normaliser
  const max = Math.max(...matrix.flat(), 1);

  return { days, hours, matrix, max };
}

// Composant Heatmap simple
function HeatmapChart({ data }) {
  const { days, matrix, max } = data;

  // Afficher seulement les heures 6h-22h pour simplifier
  const displayHours = Array.from({ length: 17 }, (_, i) => i + 6);

  const getColor = (value) => {
    if (value === 0) return 'bg-gray-100';
    const intensity = Math.min(value / max, 1);
    if (intensity < 0.25) return 'bg-blue-100';
    if (intensity < 0.5) return 'bg-blue-200';
    if (intensity < 0.75) return 'bg-blue-400';
    return 'bg-blue-600';
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        {/* Header heures */}
        <div className="flex mb-1">
          <div className="w-12"></div>
          {displayHours.map(h => (
            <div key={h} className="flex-1 text-center text-xs text-gray-500">
              {h}h
            </div>
          ))}
        </div>

        {/* Lignes par jour */}
        {days.map((day, dayIdx) => (
          <div key={day} className="flex mb-1">
            <div className="w-12 text-xs text-gray-600 flex items-center">{day}</div>
            {displayHours.map(hour => (
              <div
                key={hour}
                className={clsx(
                  'flex-1 h-6 mx-0.5 rounded',
                  getColor(matrix[dayIdx][hour])
                )}
                title={`${day} ${hour}h: ${matrix[dayIdx][hour]} tickets`}
              />
            ))}
          </div>
        ))}

        {/* Legende */}
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
          <span>Moins</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 bg-gray-100 rounded"></div>
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <div className="w-4 h-4 bg-blue-200 rounded"></div>
            <div className="w-4 h-4 bg-blue-400 rounded"></div>
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
          </div>
          <span>Plus</span>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
