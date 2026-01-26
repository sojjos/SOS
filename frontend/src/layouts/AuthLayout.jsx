import { Outlet } from 'react-router-dom';

function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">SOS</h1>
          <p className="text-primary-200">Short Operational Summary</p>
        </div>

        {/* Contenu */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="text-center text-primary-200 text-sm mt-6">
          © {new Date().getFullYear()} SOS - Tous droits réservés
        </p>
      </div>
    </div>
  );
}

export default AuthLayout;
