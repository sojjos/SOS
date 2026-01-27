import { useState, useEffect } from 'react';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowRight
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
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../../services/api';
import ExportButton from '../../components/ExportButton';
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

function MultiSitesDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30days');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await dashboardAPI.multiSites({ period: selectedPeriod });
        setData(response.data);
      } catch (error) {
        console.error('Erreur chargement dashboard multi-sites:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedPeriod]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const agencies = data?.agencies || [];
  const globalStats = data?.global_stats || {};
  const trends = data?.trends || [];

  // Préparer les données pour les graphiques
  const comparisonData = {
    labels: agencies.map(a => a.name),
    datasets: [
      {
        label: 'Tickets actifs',
        data: agencies.map(a => a.active_tickets),
        backgroundColor: 'rgba(33, 150, 243, 0.8)'
      },
      {
        label: 'Résolus ce mois',
        data: agencies.map(a => a.resolved_this_month),
        backgroundColor: 'rgba(76, 175, 80, 0.8)'
      }
    ]
  };

  const slaComparisonData = {
    labels: agencies.map(a => a.name),
    datasets: [{
      label: 'Taux SLA (%)',
      data: agencies.map(a => a.sla_compliance || 0),
      backgroundColor: agencies.map(a =>
        a.sla_compliance >= 90 ? 'rgba(76, 175, 80, 0.8)' :
        a.sla_compliance >= 70 ? 'rgba(255, 193, 7, 0.8)' :
        'rgba(244, 67, 54, 0.8)'
      )
    }]
  };

  const trendsData = {
    labels: trends.map(t => t.period),
    datasets: agencies.slice(0, 5).map((agency, i) => ({
      label: agency.name,
      data: trends.map(t => t.by_agency?.[agency.id] || 0),
      borderColor: getColorByIndex(i),
      backgroundColor: getColorByIndex(i, 0.1),
      fill: false,
      tension: 0.3
    }))
  };

  // Calculer les variations
  const getVariation = (current, previous) => {
    if (!previous || previous === 0) return null;
    return ((current - previous) / previous * 100).toFixed(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Multi-Sites</h1>
          <p className="text-gray-600">Vue consolidée de toutes les agences</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input w-40"
          >
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="90days">90 derniers jours</option>
            <option value="365days">12 derniers mois</option>
          </select>
          <ExportButton type="stats" filters={{ period: selectedPeriod }} />
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <GlobalStatCard
          icon={Building2}
          label="Agences"
          value={agencies.length}
          color="blue"
        />
        <GlobalStatCard
          icon={BarChart3}
          label="Total tickets"
          value={globalStats.total_tickets || 0}
          variation={getVariation(globalStats.total_tickets, globalStats.previous_total)}
          color="purple"
        />
        <GlobalStatCard
          icon={Clock}
          label="Tickets actifs"
          value={globalStats.active_tickets || 0}
          color="orange"
        />
        <GlobalStatCard
          icon={CheckCircle}
          label="Résolus (période)"
          value={globalStats.resolved_period || 0}
          variation={getVariation(globalStats.resolved_period, globalStats.previous_resolved)}
          color="green"
        />
        <GlobalStatCard
          icon={AlertTriangle}
          label="Critiques actifs"
          value={globalStats.critical_active || 0}
          color="red"
        />
      </div>

      {/* Graphiques de comparaison */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Comparaison par agence</h3>
          <div className="h-72">
            <Bar
              data={comparisonData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' }
                },
                scales: {
                  x: { stacked: false },
                  y: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Taux de respect SLA</h3>
          <div className="h-72">
            <Bar
              data={slaComparisonData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Tendances */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Évolution par agence</h3>
        <div className="h-80">
          <Line
            data={trendsData}
            options={{
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }}
          />
        </div>
      </div>

      {/* Classement des agences */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Performance par agence</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Agence</th>
                <th className="pb-3 font-medium text-center">Total</th>
                <th className="pb-3 font-medium text-center">Actifs</th>
                <th className="pb-3 font-medium text-center">Critiques</th>
                <th className="pb-3 font-medium text-center">Résolus</th>
                <th className="pb-3 font-medium text-center">Temps moyen</th>
                <th className="pb-3 font-medium text-center">SLA</th>
                <th className="pb-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {agencies
                .sort((a, b) => (b.sla_compliance || 0) - (a.sla_compliance || 0))
                .map((agency, index) => (
                <tr key={agency.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className={clsx(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-50 text-gray-600'
                      )}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{agency.name}</p>
                        <p className="text-xs text-gray-500">{agency.code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-center">{agency.total_tickets}</td>
                  <td className="py-4 text-center">{agency.active_tickets}</td>
                  <td className="py-4 text-center">
                    <span className={clsx(
                      'badge',
                      agency.critical_active > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                    )}>
                      {agency.critical_active || 0}
                    </span>
                  </td>
                  <td className="py-4 text-center">{agency.resolved_this_month || 0}</td>
                  <td className="py-4 text-center">
                    {agency.avg_resolution_days ? `${agency.avg_resolution_days}j` : '-'}
                  </td>
                  <td className="py-4 text-center">
                    <span className={clsx(
                      'badge',
                      agency.sla_compliance >= 90 ? 'bg-green-100 text-green-800' :
                      agency.sla_compliance >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    )}>
                      {agency.sla_compliance || 0}%
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <Link
                      to={`/admin/agencies/${agency.id}/config`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alertes */}
      {data?.alerts?.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertes
          </h3>
          <div className="space-y-2">
            {data.alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-red-800">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalStatCard({ icon: Icon, label, value, variation, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', colors[color])}>
          <Icon className="w-5 h-5" />
        </div>
        {variation !== null && (
          <div className={clsx(
            'flex items-center text-xs font-medium',
            parseFloat(variation) >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {parseFloat(variation) >= 0 ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {Math.abs(parseFloat(variation))}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}

function getColorByIndex(index, alpha = 1) {
  const colors = [
    `rgba(33, 150, 243, ${alpha})`,   // Blue
    `rgba(76, 175, 80, ${alpha})`,    // Green
    `rgba(255, 152, 0, ${alpha})`,    // Orange
    `rgba(156, 39, 176, ${alpha})`,   // Purple
    `rgba(244, 67, 54, ${alpha})`,    // Red
    `rgba(0, 188, 212, ${alpha})`,    // Cyan
    `rgba(255, 193, 7, ${alpha})`,    // Amber
    `rgba(96, 125, 139, ${alpha})`    // Blue Grey
  ];
  return colors[index % colors.length];
}

export default MultiSitesDashboard;
