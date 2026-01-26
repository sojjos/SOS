import { useState, useEffect } from 'react';
import { Plus, Search, User, Mail, Building2, Edit, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI, agenciesAPI } from '../../services/api';
import clsx from 'clsx';

function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgency, setFilterAgency] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, agenciesRes] = await Promise.all([
        adminAPI.getUsers({}),
        agenciesAPI.list()
      ]);
      setUsers(usersRes.data);
      setAgencies(agenciesRes.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAgency = !filterAgency ||
      user.agency_accesses?.some(a => a.agency_id === filterAgency);

    return matchesSearch && matchesAgency;
  });

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Nouveau mot de passe (min 8 caractères):');
    if (!newPassword) return;

    if (newPassword.length < 8) {
      toast.error('Mot de passe trop court');
      return;
    }

    try {
      await adminAPI.resetPassword(userId, newPassword);
      toast.success('Mot de passe réinitialisé');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
          <p className="text-gray-600">{users.length} utilisateur(s)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvel utilisateur
        </button>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={filterAgency}
            onChange={(e) => setFilterAgency(e.target.value)}
            className="input w-auto"
          >
            <option value="">Toutes les agences</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Utilisateur</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Agences</th>
                  <th className="pb-3 font-medium">Statut</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-700">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        'badge',
                        user.account_type === 'admin' ? 'bg-purple-100 text-purple-800' :
                        user.account_type === 'admin_delegated' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      )}>
                        {user.account_type}
                      </span>
                    </td>
                    <td className="py-4">
                      {user.agency_accesses?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.agency_accesses.slice(0, 2).map((access, i) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {access.agency_name}
                            </span>
                          ))}
                          {user.agency_accesses.length > 2 && (
                            <span className="text-xs text-gray-500">
                              +{user.agency_accesses.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <span className={clsx(
                        'badge',
                        user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      )}>
                        {user.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                          title="Réinitialiser le mot de passe"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showCreateModal && (
        <CreateUserModal
          agencies={agencies}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ agencies, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    account_type: 'user'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password || !formData.first_name || !formData.last_name) {
      toast.error('Tous les champs sont requis');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminAPI.createUser(formData);
      toast.success('Utilisateur créé avec succès');
      onCreated();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Nouvel utilisateur</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prénom *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label className="label">Mot de passe *</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label className="label">Type de compte</label>
            <select
              value={formData.account_type}
              onChange={(e) => setFormData(prev => ({ ...prev, account_type: e.target.value }))}
              className="input"
            >
              <option value="user">Utilisateur</option>
              <option value="admin_delegated">Admin délégué</option>
              <option value="admin">Admin complet</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
              {isSubmitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminUsers;
