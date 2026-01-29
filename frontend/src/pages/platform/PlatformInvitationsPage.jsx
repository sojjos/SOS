import { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Search,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  X,
  Check
} from 'lucide-react';
import { platformInvitationsAPI, platformCompaniesAPI } from '../../services/platformApi';
import toast from 'react-hot-toast';

export default function PlatformInvitationsPage() {
  const [invitations, setInvitations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    companyId: '',
    codeType: '',
    isActive: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [pagination.page, filters.companyId, filters.codeType, filters.isActive]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invitationsRes, companiesRes] = await Promise.all([
        platformInvitationsAPI.list({
          page: pagination.page,
          limit: 20,
          search: filters.search || undefined,
          companyId: filters.companyId || undefined,
          codeType: filters.codeType || undefined,
          isActive: filters.isActive || undefined,
        }),
        platformCompaniesAPI.list({ limit: 100 }),
      ]);
      setInvitations(invitationsRes.invitations);
      setPagination(invitationsRes.pagination);
      setCompanies(companiesRes.companies);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    loadData();
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copie dans le presse-papiers');
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce code d\'invitation ?')) return;

    try {
      await platformInvitationsAPI.delete(id);
      toast.success('Code supprime');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await platformInvitationsAPI.update(id, { isActive: !currentStatus });
      toast.success(currentStatus ? 'Code desactive' : 'Code active');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const getCodeTypeBadge = (codeType) => {
    const types = {
      company_registration: { label: 'Entreprise', color: 'bg-purple-500/20 text-purple-400' },
      admin_invite: { label: 'Admin', color: 'bg-blue-500/20 text-blue-400' },
      user_invite: { label: 'Utilisateur', color: 'bg-green-500/20 text-green-400' },
    };
    const type = types[codeType] || { label: codeType, color: 'bg-gray-500/20 text-gray-400' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${type.color}`}>{type.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Codes d'invitation</h1>
          <p className="text-gray-400 mt-1">{pagination.total} codes au total</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          Nouveau code
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text"
                placeholder="Rechercher un code..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <select
            value={filters.companyId}
            onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Toutes les entreprises</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={filters.codeType}
            onChange={(e) => setFilters({ ...filters, codeType: e.target.value })}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tous les types</option>
            <option value="company_registration">Inscription entreprise</option>
            <option value="admin_invite">Invitation admin</option>
            <option value="user_invite">Invitation utilisateur</option>
          </select>

          <select
            value={filters.isActive}
            onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Filtrer
          </button>
        </form>
      </div>

      {/* Table */}
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
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Entreprise</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Utilisations</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">Expire</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {invitations.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-purple-400 font-mono">{inv.code}</code>
                        <button
                          onClick={() => handleCopyCode(inv.code)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Copier"
                        >
                          <Copy className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getCodeTypeBadge(inv.code_type)}</td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">{inv.company_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300">
                        {inv.current_uses} / {inv.max_uses}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        inv.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {inv.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-400 text-sm">
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('fr-FR') : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(inv.id, inv.is_active)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title={inv.is_active ? 'Desactiver' : 'Activer'}
                        >
                          {inv.is_active ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {invitations.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Aucun code d'invitation trouve
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-700/30 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              Page {pagination.page} sur {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-400" />
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateInvitationModal
          companies={companies}
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}

function CreateInvitationModal({ companies, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    codeType: 'company_registration',
    companyId: '',
    maxUses: 1,
    expiresInDays: 30,
    customCode: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await platformInvitationsAPI.create(formData);
      setCreatedCode(response.invitation.code);
      onCreated();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    } finally {
      setLoading(false);
    }
  };

  if (createdCode) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-xl w-full max-w-md m-4 p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Code cree avec succes</h2>
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <code className="text-2xl text-purple-400 font-mono">{createdCode}</code>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(createdCode);
              toast.success('Code copie');
            }}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg mb-3 flex items-center justify-center gap-2"
          >
            <Copy className="h-5 w-5" />
            Copier le code
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Nouveau code d'invitation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type de code *
            </label>
            <select
              value={formData.codeType}
              onChange={(e) => setFormData({ ...formData, codeType: e.target.value })}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="company_registration">Inscription entreprise</option>
              <option value="admin_invite">Invitation admin</option>
              <option value="user_invite">Invitation utilisateur</option>
            </select>
          </div>

          {formData.codeType !== 'company_registration' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entreprise *
              </label>
              <select
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                required
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Selectionner une entreprise</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Utilisations max
              </label>
              <input
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) })}
                min="1"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Validite (jours)
              </label>
              <input
                type="number"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: parseInt(e.target.value) })}
                min="1"
                max="365"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Code personnalise (optionnel)
            </label>
            <input
              type="text"
              value={formData.customCode}
              onChange={(e) => setFormData({ ...formData, customCode: e.target.value.toUpperCase() })}
              placeholder="Laisser vide pour generer automatiquement"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              {loading ? 'Creation...' : 'Creer le code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
