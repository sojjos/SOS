import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Shield,
  Edit,
  Trash2,
  Key,
  X,
  AlertCircle
} from 'lucide-react';
import { platformAdminsAPI } from '../../services/platformApi';
import usePlatformStore from '../../store/platformStore';
import toast from 'react-hot-toast';

export default function PlatformAdminsPage() {
  const { isSuperAdmin, admin: currentAdmin } = usePlatformStore();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState(null);

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const response = await platformAdminsAPI.list();
      setAdmins(response.admins);
    } catch (error) {
      console.error('Erreur chargement admins:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Etes-vous sur de vouloir desactiver cet administrateur ?')) return;

    try {
      await platformAdminsAPI.delete(id);
      toast.success('Administrateur desactive');
      loadAdmins();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const getRoleBadge = (role) => {
    const roles = {
      super_admin: { label: 'Super Admin', color: 'bg-purple-500/20 text-purple-400' },
      admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-400' },
      viewer: { label: 'Lecteur', color: 'bg-gray-500/20 text-gray-400' },
    };
    const r = roles[role] || { label: role, color: 'bg-gray-500/20 text-gray-400' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${r.color}`}>{r.label}</span>;
  };

  if (!isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Acces reserve aux super administrateurs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Administrateurs</h1>
          <p className="text-gray-400 mt-1">Gestion des administrateurs de la plateforme</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nouvel admin
        </button>
      </div>

      {/* List */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Admin</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Derniere connexion</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
                          <span className="text-purple-400 font-medium">
                            {admin.first_name?.[0]}{admin.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{admin.first_name} {admin.last_name}</p>
                          <p className="text-gray-400 text-sm">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getRoleBadge(admin.role)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        admin.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {admin.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 text-sm">
                        {admin.last_login ? new Date(admin.last_login).toLocaleString('fr-FR') : 'Jamais'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {admin.id !== currentAdmin?.id && (
                          <>
                            <button
                              onClick={() => setEditingAdmin(admin)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit className="h-4 w-4 text-gray-400" />
                            </button>
                            <button
                              onClick={() => setResetPasswordAdmin(admin)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                              title="Reinitialiser mot de passe"
                            >
                              <Key className="h-4 w-4 text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDelete(admin.id)}
                              className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {admin.id === currentAdmin?.id && (
                          <span className="text-xs text-gray-500">(vous)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {admins.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Aucun administrateur
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <AdminFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={loadAdmins}
        />
      )}

      {/* Edit Modal */}
      {editingAdmin && (
        <AdminFormModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSaved={loadAdmins}
        />
      )}

      {/* Reset Password Modal */}
      {resetPasswordAdmin && (
        <ResetPasswordModal
          admin={resetPasswordAdmin}
          onClose={() => setResetPasswordAdmin(null)}
        />
      )}
    </div>
  );
}

function AdminFormModal({ admin, onClose, onSaved }) {
  const isEdit = !!admin;
  const [formData, setFormData] = useState({
    email: admin?.email || '',
    firstName: admin?.first_name || '',
    lastName: admin?.last_name || '',
    password: '',
    role: admin?.role || 'admin',
    isActive: admin?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        const updateData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          isActive: formData.isActive,
        };
        await platformAdminsAPI.update(admin.id, updateData);
        toast.success('Administrateur modifie');
      } else {
        if (!formData.password || formData.password.length < 12) {
          setError('Le mot de passe doit faire au moins 12 caracteres');
          setLoading(false);
          return;
        }
        await platformAdminsAPI.create(formData);
        toast.success('Administrateur cree');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md m-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {isEdit ? 'Modifier l\'administrateur' : 'Nouvel administrateur'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prenom *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nom *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {!isEdit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe * (min. 12 car.)</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={12}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Role *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="viewer">Lecteur</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="isActive" className="text-gray-300">Compte actif</label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ admin, onClose }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 12) {
      setError('Le mot de passe doit faire au moins 12 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await platformAdminsAPI.resetPassword(admin.id, password);
      toast.success('Mot de passe reinitialise');
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md m-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Reinitialiser le mot de passe</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-gray-400 text-sm">
            Reinitialiser le mot de passe de <strong className="text-white">{admin.email}</strong>
          </p>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nouveau mot de passe * (min. 12 car.)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Reinitialisation...' : 'Reinitialiser'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
