import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Users, Ticket, TrendingUp, Settings, FileText } from 'lucide-react';
import { adminAPI } from '../../services/api';
import clsx from 'clsx';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await adminAPI.getStats();
        setStats(response.data);
      } catch (error) {
        console.error('Erreur chargement stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const quickLinks = [
    { to: '/admin/agencies', icon: Building2, label: 'Gérer les agences', color: 'bg-blue-100 text-blue-600' },
    { to: '/admin/users', icon: Users, label: 'Gérer les utilisateurs', color: 'bg-purple-100 text-purple-600' },
    { to: '/admin/logs', icon: FileText, label: 'Consulter les logs', color: 'bg-gray-100 text-gray-600' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="text-gray-600">Vue d'ensemble du système SOS</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Agences actives"
          value={stats?.agencies_count || 0}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Utilisateurs actifs"
          value={stats?.users_count || 0}
          color="purple"
        />
        <StatCard
          icon={Ticket}
          label="Total tickets"
          value={stats?.total_tickets || 0}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="Tickets actifs"
          value={stats?.active_tickets || 0}
          color="orange"
        />
      </div>

      {/* Quick Links */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-gray-50 transition-colors"
            >
              <div className={clsx('p-3 rounded-lg', link.color)}>
                <link.icon className="w-6 h-6" />
              </div>
              <span className="font-medium text-gray-900">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600'
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

export default AdminDashboard;
