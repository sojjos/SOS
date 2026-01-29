import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Users,
  MapPin,
  Ticket,
  TrendingUp,
  AlertTriangle,
  Activity,
  Server,
  Clock,
  ChevronRight
} from 'lucide-react';
import { platformDashboardAPI } from '../../services/platformApi';

export default function PlatformDashboardPage() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [dashboardData, healthData] = await Promise.all([
        platformDashboardAPI.getOverview(),
        platformDashboardAPI.getHealth()
      ]);
      setData(dashboardData);
      setHealth(healthData);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Plateforme</h1>
          <p className="text-gray-400 mt-1">Vue d'ensemble de la plateforme SOS</p>
        </div>

        {/* System Health */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            health?.status === 'healthy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <Server className="h-4 w-4" />
            <span className="text-sm font-medium">
              {health?.status === 'healthy' ? 'Système OK' : 'Problème'}
            </span>
            {health?.database?.latencyMs && (
              <span className="text-xs opacity-70">
                ({health.database.latencyMs}ms)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Entreprises"
          value={stats.total_companies || 0}
          subtitle={`${stats.active_companies || 0} actives, ${stats.trial_companies || 0} en essai`}
          icon={Building2}
          color="purple"
        />
        <StatCard
          title="Sites"
          value={stats.total_sites || 0}
          subtitle="Sites actifs"
          icon={MapPin}
          color="blue"
        />
        <StatCard
          title="Utilisateurs"
          value={stats.total_users || 0}
          subtitle={`${stats.total_admins || 0} administrateurs`}
          icon={Users}
          color="green"
        />
        <StatCard
          title="Tickets"
          value={stats.total_tickets || 0}
          subtitle={`${stats.tickets_24h || 0} dernières 24h`}
          icon={Ticket}
          color="orange"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Companies */}
        {data?.alertCompanies?.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-white">Alertes</h2>
            </div>
            <div className="space-y-3">
              {data.alertCompanies.map((company) => (
                <Link
                  key={company.id}
                  to={`/platform/companies/${company.id}`}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div>
                    <p className="text-white font-medium">{company.name}</p>
                    <p className="text-sm text-gray-400">
                      {company.alert_type === 'trial_expiring' && 'Essai expire bientot'}
                      {company.alert_type === 'sites_limit' && 'Limite de sites atteinte'}
                      {company.alert_type === 'users_limit' && 'Limite d\'utilisateurs atteinte'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Companies */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Entreprises recentes</h2>
            <Link to="/platform/companies" className="text-purple-400 hover:text-purple-300 text-sm">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {data?.recentCompanies?.map((company) => (
              <Link
                key={company.id}
                to={`/platform/companies/${company.id}`}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{company.name}</p>
                    <p className="text-sm text-gray-400">
                      {company.current_sites_count} sites, {company.current_users_count} utilisateurs
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  company.subscription_status === 'active' ? 'bg-green-500/20 text-green-400' :
                  company.subscription_status === 'trial' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {company.subscription_status}
                </span>
              </Link>
            ))}
            {(!data?.recentCompanies || data.recentCompanies.length === 0) && (
              <p className="text-gray-500 text-center py-4">Aucune entreprise</p>
            )}
          </div>
        </div>

        {/* Top Active Companies */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold text-white">Plus actives (7j)</h2>
          </div>
          <div className="space-y-3">
            {data?.topCompanies?.map((company, index) => (
              <div
                key={company.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-purple-600/30 rounded-full flex items-center justify-center text-purple-400 text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-white">{company.name}</span>
                </div>
                <span className="text-gray-400 text-sm">{company.tickets_7d} tickets</span>
              </div>
            ))}
            {(!data?.topCompanies || data.topCompanies.length === 0) && (
              <p className="text-gray-500 text-center py-4">Aucune activite</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-white">Activite recente</h2>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data?.recentActivity?.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-2 border-b border-gray-700 last:border-0">
                <Clock className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {log.admin_first_name} {log.admin_last_name}
                    <span className="text-gray-400"> - {log.action}</span>
                  </p>
                  {log.company_name && (
                    <p className="text-xs text-gray-500">{log.company_name}</p>
                  )}
                  <p className="text-xs text-gray-600">
                    {new Date(log.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
            {(!data?.recentActivity || data.recentActivity.length === 0) && (
              <p className="text-gray-500 text-center py-4">Aucune activite</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    purple: 'bg-purple-600/20 text-purple-400',
    blue: 'bg-blue-600/20 text-blue-400',
    green: 'bg-green-600/20 text-green-400',
    orange: 'bg-orange-600/20 text-orange-400',
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
