import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Bell,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ChevronDown,
  Shield
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useNotificationStore from '../store/notificationStore';
import { agenciesAPI } from '../services/api';
import clsx from 'clsx';

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agencyMenuOpen, setAgencyMenuOpen] = useState(false);
  const [agencies, setAgencies] = useState([]);

  const { user, currentAgency, setCurrentAgency, logout, isAdmin, adminMode, toggleAdminMode } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();

  // Charger les agences disponibles
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        const response = await agenciesAPI.list();
        setAgencies(response.data);

        // Sélectionner la première agence si aucune n'est sélectionnée
        if (!currentAgency && response.data.length > 0) {
          setCurrentAgency(response.data[0]);
        }
      } catch (error) {
        console.error('Erreur chargement agences:', error);
      }
    };

    loadAgencies();
  }, [currentAgency, setCurrentAgency]);

  // Récupérer le compteur de notifications
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Toutes les minutes
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tickets', icon: Ticket, label: 'Tickets' },
    { path: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { path: '/profile', icon: User, label: 'Profil' },
  ];

  const adminItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Vue d\'ensemble' },
    { path: '/admin/agencies', icon: Building2, label: 'Agences' },
    { path: '/admin/users', icon: User, label: 'Utilisateurs' },
    { path: '/admin/logs', icon: Settings, label: 'Logs' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header sidebar */}
        <div className="h-16 flex items-center justify-between px-4 border-b">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">SOS</h1>
              <p className="text-xs text-gray-500">Short Operational Summary</p>
            </div>
          </Link>
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sélecteur d'agence */}
        {!adminMode && (
          <div className="p-4 border-b">
            <div className="relative">
              <button
                onClick={() => setAgencyMenuOpen(!agencyMenuOpen)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-700 truncate">
                    {currentAgency?.name || 'Sélectionner...'}
                  </span>
                </div>
                <ChevronDown className={clsx('w-4 h-4 text-gray-500 transition-transform', agencyMenuOpen && 'rotate-180')} />
              </button>

              {agencyMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {agencies.map((agency) => (
                    <button
                      key={agency.id}
                      onClick={() => {
                        setCurrentAgency(agency);
                        setAgencyMenuOpen(false);
                      }}
                      className={clsx(
                        'w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors',
                        currentAgency?.id === agency.id && 'bg-primary-50 text-primary-700'
                      )}
                    >
                      {agency.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 flex-1 overflow-y-auto">
          {/* Mode Admin toggle */}
          {isAdmin() && (
            <button
              onClick={toggleAdminMode}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-4 transition-colors',
                adminMode
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">
                {adminMode ? 'Mode Admin' : 'Mode Agence'}
              </span>
            </button>
          )}

          {/* Items de navigation */}
          <ul className="space-y-1">
            {(adminMode ? adminItems : navItems).map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 font-semibold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar mobile */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-gray-900">SOS</h1>
          <Link to="/notifications" className="p-2 rounded-lg hover:bg-gray-100 relative">
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
