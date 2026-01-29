import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import { initWebSocket, disconnectWebSocket } from './services/websocket';
import PWAUpdatePrompt from './components/PWAUpdatePrompt';
import PWAInstallPrompt from './components/PWAInstallPrompt';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import PlatformLayout from './layouts/PlatformLayout';

// Pages Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import RequestAccountPage from './pages/auth/RequestAccountPage';
import RegisterCompanyPage from './pages/auth/RegisterCompanyPage';

// Pages Platform Admin
import PlatformLoginPage from './pages/platform/PlatformLoginPage';
import PlatformDashboardPage from './pages/platform/PlatformDashboardPage';
import PlatformCompaniesPage from './pages/platform/PlatformCompaniesPage';
import PlatformInvitationsPage from './pages/platform/PlatformInvitationsPage';
import PlatformAdminsPage from './pages/platform/PlatformAdminsPage';

// Pages principales
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/tickets/TicketsPage';
import TicketDetailPage from './pages/tickets/TicketDetailPage';
import CreateTicketPage from './pages/tickets/CreateTicketPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Pages Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAgencies from './pages/admin/AdminAgencies';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLogs from './pages/admin/AdminLogs';
import AgencyConfig from './pages/admin/AgencyConfig';
import MultiSitesDashboard from './pages/admin/MultiSitesDashboard';

// Pages Syndicat
import UnionDashboard from './pages/union/UnionDashboard';
import UnionTicketDetail from './pages/union/UnionTicketDetail';

// Composant de route protégée
function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isLoading, isAdmin } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Composant de route publique (redirect si déjà connecté)
function PublicRoute({ children, allowAuthenticated = false }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated && !allowAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Composant de route syndicat (vérifie si l'utilisateur est membre du syndicat)
function UnionRoute({ children }) {
  const { isAuthenticated, isLoading, isUnionMember, isAdmin } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Les admins peuvent aussi accéder à la vue syndicat
  if (!isUnionMember() && !isAdmin()) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const { initialize, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Initialiser WebSocket quand l'utilisateur est authentifie
  useEffect(() => {
    if (isAuthenticated && token) {
      initWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isAuthenticated, token]);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#fff',
            color: '#363636',
          },
        }}
      />
      <Routes>
      {/* Routes publiques (authentification) */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPasswordPage />
            </PublicRoute>
          }
        />
        <Route
          path="/request-account"
          element={
            <PublicRoute>
              <RequestAccountPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterCompanyPage />
            </PublicRoute>
          }
        />
      </Route>

      {/* Routes Platform Admin */}
      <Route path="/platform/login" element={<PlatformLoginPage />} />
      <Route element={<PlatformLayout />}>
        <Route path="/platform/dashboard" element={<PlatformDashboardPage />} />
        <Route path="/platform/companies" element={<PlatformCompaniesPage />} />
        <Route path="/platform/companies/:id" element={<PlatformCompaniesPage />} />
        <Route path="/platform/invitations" element={<PlatformInvitationsPage />} />
        <Route path="/platform/admins" element={<PlatformAdminsPage />} />
      </Route>

      {/* Routes protégées */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/" element={<DashboardPage />} />

        {/* Tickets */}
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/new" element={<CreateTicketPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />

        {/* Profil */}
        <Route path="/profile" element={<ProfilePage />} />

        {/* Notifications */}
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* Analytics */}
        <Route path="/analytics" element={<AnalyticsPage />} />

        {/* Routes Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/agencies"
          element={
            <ProtectedRoute adminOnly>
              <AdminAgencies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/agencies/:id/config"
          element={
            <ProtectedRoute adminOnly>
              <AgencyConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logs"
          element={
            <ProtectedRoute adminOnly>
              <AdminLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/multi-sites"
          element={
            <ProtectedRoute adminOnly>
              <MultiSitesDashboard />
            </ProtectedRoute>
          }
        />

        {/* Routes Syndicat */}
        <Route
          path="/union"
          element={
            <UnionRoute>
              <UnionDashboard />
            </UnionRoute>
          }
        />
        <Route
          path="/union/tickets/:id"
          element={
            <UnionRoute>
              <UnionTicketDetail />
            </UnionRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <PWAUpdatePrompt />
    <PWAInstallPrompt />
    </>
  );
}

export default App;
