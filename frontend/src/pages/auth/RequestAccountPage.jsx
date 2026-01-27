import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, Building2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountRequestsAPI, agenciesAPI } from '../../services/api';

function RequestAccountPage() {
  const [step, setStep] = useState(1); // 1: form, 2: success
  const [agencies, setAgencies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    message: '',
    requested_agencies: []
  });

  // Charger la liste des agences
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        const response = await agenciesAPI.listPublic();
        setAgencies(response.data);
      } catch (error) {
        console.error('Erreur chargement agences:', error);
      }
    };
    loadAgencies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addAgency = (agencyId) => {
    if (formData.requested_agencies.some(a => a.agency_id === agencyId)) {
      toast.error('Agence déjà sélectionnée');
      return;
    }

    setFormData(prev => ({
      ...prev,
      requested_agencies: [
        ...prev.requested_agencies,
        { agency_id: agencyId, role: '' }
      ]
    }));
  };

  const removeAgency = (agencyId) => {
    setFormData(prev => ({
      ...prev,
      requested_agencies: prev.requested_agencies.filter(a => a.agency_id !== agencyId)
    }));
  };

  const updateAgencyRole = (agencyId, role) => {
    setFormData(prev => ({
      ...prev,
      requested_agencies: prev.requested_agencies.map(a =>
        a.agency_id === agencyId ? { ...a, role } : a
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.first_name || !formData.last_name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.requested_agencies.length === 0) {
      toast.error('Veuillez sélectionner au moins une agence');
      return;
    }

    setIsLoading(true);

    try {
      await accountRequestsAPI.create(formData);
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Demande envoyée !
        </h2>
        <p className="text-gray-600 mb-6">
          Votre demande de création de compte a été envoyée aux administrateurs.
          Vous recevrez un email lorsque votre compte sera activé.
        </p>
        <Link to="/login" className="btn btn-primary">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        Demande de compte
      </h2>
      <p className="text-gray-600 text-center mb-6">
        Remplissez ce formulaire pour demander un accès au système SOS.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Informations personnelles */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="first_name" className="label">Prénom *</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              value={formData.first_name}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
          <div>
            <label htmlFor="last_name" className="label">Nom *</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              value={formData.last_name}
              onChange={handleChange}
              className="input"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="label">Email professionnel *</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="label">Téléphone</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            className="input"
          />
        </div>

        {/* Sélection des agences */}
        <div>
          <label className="label">Agences demandées *</label>
          <p className="text-sm text-gray-500 mb-2">
            Sélectionnez les agences auxquelles vous souhaitez avoir accès.
          </p>

          {/* Agences sélectionnées */}
          {formData.requested_agencies.length > 0 && (
            <div className="space-y-2 mb-4">
              {formData.requested_agencies.map(req => {
                const agency = agencies.find(a => a.id === req.agency_id);
                return (
                  <div
                    key={req.agency_id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <Building2 className="w-5 h-5 text-gray-500" />
                    <span className="flex-1 font-medium">{agency?.name}</span>
                    <input
                      type="text"
                      placeholder="Votre rôle/fonction"
                      value={req.role}
                      onChange={(e) => updateAgencyRole(req.agency_id, e.target.value)}
                      className="input w-40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeAgency(req.agency_id)}
                      className="p-1 text-red-500 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sélecteur d'agence */}
          <div className="flex gap-2">
            <select
              id="agency-select"
              className="input flex-1"
              defaultValue=""
            >
              <option value="" disabled>Choisir une agence...</option>
              {agencies
                .filter(a => !formData.requested_agencies.some(r => r.agency_id === a.id))
                .map(agency => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name} ({agency.city})
                  </option>
                ))
              }
            </select>
            <button
              type="button"
              onClick={() => {
                const select = document.getElementById('agency-select');
                if (select.value) {
                  addAgency(select.value);
                  select.value = '';
                }
              }}
              className="btn btn-secondary"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="label">Message (optionnel)</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={3}
            className="input"
            placeholder="Informations complémentaires sur votre demande..."
          />
        </div>

        {/* Actions */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send className="w-5 h-5" />
              Envoyer la demande
            </>
          )}
        </button>

        <Link
          to="/login"
          className="block text-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 inline mr-1" />
          Retour à la connexion
        </Link>
      </form>
    </div>
  );
}

export default RequestAccountPage;
