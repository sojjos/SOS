import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { ticketsAPI, agenciesAPI } from '../../services/api';
import clsx from 'clsx';

function CreateTicketPage() {
  const navigate = useNavigate();
  const { currentAgency } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [problemTypes, setProblemTypes] = useState([]);
  const [locations, setLocations] = useState([]);

  // Formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    problem_type_id: '',
    location_id: '',
    proposed_urgency: 'moyenne',
    blocking_level: 'non_bloquant'
  });

  // Charger les données de configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentAgency) return;

      try {
        const [typesRes, locationsRes] = await Promise.all([
          agenciesAPI.getProblemTypes(currentAgency.id),
          agenciesAPI.getLocations(currentAgency.id)
        ]);

        setProblemTypes(typesRes.data);
        setLocations(locationsRes.data);
      } catch (error) {
        console.error('Erreur chargement config:', error);
        toast.error('Erreur lors du chargement de la configuration');
      }
    };

    loadConfig();
  }, [currentAgency]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast.error('Le titre est requis');
      return;
    }
    if (!formData.problem_type_id) {
      toast.error('Le type de problème est requis');
      return;
    }

    setIsLoading(true);

    try {
      const response = await ticketsAPI.create({
        ...formData,
        agency_id: currentAgency.id
      });

      toast.success('Ticket créé avec succès');
      navigate(`/tickets/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentAgency) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Veuillez sélectionner une agence</p>
      </div>
    );
  }

  const urgencyOptions = [
    { value: 'basse', label: 'Basse', description: 'Peut attendre, impact minimal', color: 'border-green-500' },
    { value: 'moyenne', label: 'Moyenne', description: 'À traiter dans les délais normaux', color: 'border-yellow-500' },
    { value: 'haute', label: 'Haute', description: 'Prioritaire, impact significatif', color: 'border-orange-500' },
    { value: 'critique', label: 'Critique', description: 'Urgent, blocage majeur', color: 'border-red-500' }
  ];

  const blockingOptions = [
    { value: 'non_bloquant', label: 'Non bloquant', description: 'Activité peut continuer normalement' },
    { value: 'partiel', label: 'Partiellement bloquant', description: 'Activité possible en mode dégradé' },
    { value: 'bloquant', label: 'Bloquant', description: 'Activité totalement arrêtée' }
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau ticket</h1>
          <p className="text-gray-600">{currentAgency.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations principales */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Informations du problème</h2>

          <div>
            <label htmlFor="title" className="label">
              Titre du problème *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="Décrivez brièvement le problème"
              maxLength={200}
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description détaillée
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="input"
              placeholder="Décrivez le problème en détail : contexte, symptômes, impact..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="problem_type_id" className="label">
                Type de problème *
              </label>
              <select
                id="problem_type_id"
                name="problem_type_id"
                value={formData.problem_type_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Sélectionner...</option>
                {problemTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="location_id" className="label">
                Lieu
              </label>
              <select
                id="location_id"
                name="location_id"
                value={formData.location_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Sélectionner...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Niveau d'urgence proposé */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Niveau d'urgence proposé</h2>
          <p className="text-sm text-gray-600">
            Ce niveau sera validé ou ajusté par votre responsable.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {urgencyOptions.map((option) => (
              <label
                key={option.value}
                className={clsx(
                  'relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all',
                  formData.proposed_urgency === option.value
                    ? `${option.color} bg-gray-50`
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="proposed_urgency"
                  value={option.value}
                  checked={formData.proposed_urgency === option.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Impact sur l'activité */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Impact sur l'activité</h2>

          <div className="space-y-3">
            {blockingOptions.map((option) => (
              <label
                key={option.value}
                className={clsx(
                  'flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all',
                  formData.blocking_level === option.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="blocking_level"
                  value={option.value}
                  checked={formData.blocking_level === option.value}
                  onChange={handleChange}
                  className="sr-only"
                />
                <div>
                  <p className="font-medium text-gray-900">{option.label}</p>
                  <p className="text-sm text-gray-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Information</p>
            <p className="text-blue-700">
              Après création, votre ticket sera transmis à votre responsable pour validation.
              Le niveau d'urgence final et les délais SLA seront définis lors de cette validation.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary flex items-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Créer le ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTicketPage;
