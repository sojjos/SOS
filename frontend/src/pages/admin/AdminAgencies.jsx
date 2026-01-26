import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings, Building2, MapPin, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { agenciesAPI, adminAPI } from '../../services/api';
import clsx from 'clsx';

function AdminAgencies() {
  const [agencies, setAgencies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadAgencies();
  }, []);

  const loadAgencies = async () => {
    try {
      const response = await agenciesAPI.list();
      setAgencies(response.data);
    } catch (error) {
      console.error('Erreur chargement agences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agences</h1>
          <p className="text-gray-600">{agencies.length} agence(s) configurée(s)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle agence
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : agencies.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune agence</h3>
          <p className="text-gray-600 mb-4">Commencez par créer votre première agence</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Créer une agence
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agencies.map((agency) => (
            <div key={agency.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{agency.name}</h3>
                    <p className="text-sm text-gray-500">{agency.code}</p>
                  </div>
                </div>
                <span className={clsx(
                  'badge',
                  agency.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                )}>
                  {agency.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {agency.city && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <MapPin className="w-4 h-4" />
                  {agency.city}, {agency.country}
                </div>
              )}

              <Link
                to={`/admin/agencies/${agency.id}/config`}
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurer
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      {showCreateModal && (
        <CreateAgencyModal
          agencies={agencies}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadAgencies();
          }}
        />
      )}
    </div>
  );
}

function CreateAgencyModal({ agencies, onClose, onCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: 'Belgique',
    copy_from_agency_id: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.code) {
      toast.error('Nom et code requis');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminAPI.createAgency(formData);
      toast.success('Agence créée avec succès');
      onCreated();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Nouvelle agence</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Nom de l'agence *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="Ex: STEF Tubize"
            />
          </div>

          <div>
            <label className="label">Code *</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              className="input"
              placeholder="Ex: TUB"
              maxLength={10}
            />
          </div>

          <div>
            <label className="label">Ville</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="input"
              placeholder="Ex: Tubize"
            />
          </div>

          <div>
            <label className="label">Pays</label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="input"
            />
          </div>

          {agencies.length > 0 && (
            <div>
              <label className="label">Copier la configuration depuis</label>
              <select
                value={formData.copy_from_agency_id}
                onChange={(e) => setFormData(prev => ({ ...prev, copy_from_agency_id: e.target.value }))}
                className="input"
              >
                <option value="">Ne pas copier</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Copie les niveaux, types de problèmes, lieux et SLA
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminAgencies;
