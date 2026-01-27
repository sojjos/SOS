import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, AlertCircle, Info, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { ticketsAPI, agenciesAPI } from '../../services/api';
import clsx from 'clsx';

function CreateTicketPage() {
  const navigate = useNavigate();
  const { currentAgency, getCurrentLevel, getProfileTypes, user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [problemTypes, setProblemTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentLevel = getCurrentLevel();
  const profileTypes = getProfileTypes();
  const hasMultipleProfiles = profileTypes.length > 1;

  // Formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    problem_type_id: '',
    primary_location_id: '',
    location_details: '',
    proposed_urgency: 'moyenne',
    proposed_blocking: 'non_bloquant',
    recurrence: 'ponctuel',
    recurrence_details: '',
    impact_description: '',
    has_workaround: false,
    workaround: '',
    profile_type: profileTypes[0] || 'terrain'
  });

  // Charger les donnees de configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!currentAgency) return;

      try {
        const [typesRes, locationsRes] = await Promise.all([
          agenciesAPI.getProblemTypes(currentAgency.id),
          agenciesAPI.getLocations(currentAgency.id)
        ]);

        // Le backend filtre deja les types selon le niveau de l'utilisateur
        // via min_level_required, donc on utilise directement la reponse
        setProblemTypes(typesRes.data);
        setLocations(locationsRes.data);
      } catch (error) {
        console.error('Erreur chargement config:', error);
        toast.error('Erreur lors du chargement de la configuration');
      }
    };

    loadConfig();
  }, [currentAgency, currentLevel]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title.trim()) {
      toast.error('Le titre est requis');
      return;
    }
    if (!formData.description.trim()) {
      toast.error('La description est requise');
      return;
    }
    if (!formData.problem_type_id) {
      toast.error('Le type de probleme est requis');
      return;
    }

    setIsLoading(true);

    try {
      const response = await ticketsAPI.create({
        agency_id: currentAgency.id,
        title: formData.title,
        description: formData.description,
        problem_type_id: formData.problem_type_id,
        primary_location_id: formData.primary_location_id || null,
        location_details: formData.location_details || null,
        proposed_urgency: formData.proposed_urgency,
        proposed_blocking: formData.proposed_blocking,
        recurrence: formData.recurrence,
        recurrence_details: formData.recurrence_details || null,
        impact_description: formData.impact_description || null,
        has_workaround: formData.has_workaround,
        workaround: formData.has_workaround ? formData.workaround : null,
        profile_type: formData.profile_type
      });

      toast.success('Ticket cree avec succes');
      navigate(`/tickets/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la creation');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentAgency) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Veuillez selectionner une agence</p>
      </div>
    );
  }

  const urgencyOptions = [
    { value: 'basse', label: 'Basse', description: 'Peut attendre, impact minimal', color: 'border-green-500 bg-green-50' },
    { value: 'moyenne', label: 'Moyenne', description: 'A traiter dans les delais normaux', color: 'border-yellow-500 bg-yellow-50' },
    { value: 'haute', label: 'Haute', description: 'Prioritaire, impact significatif', color: 'border-orange-500 bg-orange-50' },
    { value: 'critique', label: 'Critique', description: 'Urgent, blocage majeur', color: 'border-red-500 bg-red-50' }
  ];

  const blockingOptions = [
    { value: 'non_bloquant', label: 'Non bloquant', description: 'Activite peut continuer normalement' },
    { value: 'partiel', label: 'Partiellement bloquant', description: 'Activite possible en mode degrade' },
    { value: 'bloquant', label: 'Bloquant', description: 'Activite totalement arretee' }
  ];

  const recurrenceOptions = [
    { value: 'ponctuel', label: 'Ponctuel', description: 'Premiere occurrence' },
    { value: 'occasionnel', label: 'Occasionnel', description: 'Se produit de temps en temps' },
    { value: 'frequent', label: 'Frequent', description: 'Se produit regulierement' },
    { value: 'permanent', label: 'Permanent', description: 'Probleme constant' }
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Nouveau ticket</h1>
          <p className="text-gray-600">{currentAgency.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Votre niveau</p>
          <p className="font-semibold text-primary-600">Niveau {currentLevel}</p>
        </div>
      </div>

      {/* Selecteur de profil si l'utilisateur a les deux */}
      {hasMultipleProfiles && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Type de ticket</h2>
          <p className="text-sm text-gray-600 mb-4">
            Vous avez acces aux deux branches. Selectionnez la branche concernee par ce ticket.
          </p>
          <div className="flex gap-4">
            <label className={clsx(
              'flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
              formData.profile_type === 'terrain'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            )}>
              <input
                type="radio"
                name="profile_type"
                value="terrain"
                checked={formData.profile_type === 'terrain'}
                onChange={handleChange}
                className="sr-only"
              />
              <div>
                <p className="font-medium text-gray-900">🏭 Terrain</p>
                <p className="text-sm text-gray-500">Operations, production, logistique</p>
              </div>
            </label>
            <label className={clsx(
              'flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all',
              formData.profile_type === 'administratif'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            )}>
              <input
                type="radio"
                name="profile_type"
                value="administratif"
                checked={formData.profile_type === 'administratif'}
                onChange={handleChange}
                className="sr-only"
              />
              <div>
                <p className="font-medium text-gray-900">🏢 Administratif</p>
                <p className="text-sm text-gray-500">Bureau, RH, comptabilite</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Info selon le niveau */}
      {currentLevel === 0 && (
        <div className="flex items-start gap-3 p-4 mb-6 bg-blue-50 rounded-lg border border-blue-200">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Vous etes au niveau terrain</p>
            <p className="text-blue-700">
              Votre ticket sera transmis au niveau superieur pour validation.
              Une fois valide, il pourra etre traite ou escalade si necessaire.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations principales */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Informations du probleme</h2>

          <div>
            <label htmlFor="title" className="label">
              Titre du probleme *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="Decrivez brievement le probleme"
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">{formData.title.length}/200 caracteres</p>
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description detaillee *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="input"
              placeholder="Decrivez le probleme en detail : contexte, symptomes, impact..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="problem_type_id" className="label">
                Type de probleme *
              </label>
              <select
                id="problem_type_id"
                name="problem_type_id"
                value={formData.problem_type_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Selectionner...</option>
                {problemTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.icon} {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="primary_location_id" className="label">
                Lieu
              </label>
              <select
                id="primary_location_id"
                name="primary_location_id"
                value={formData.primary_location_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Selectionner...</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.primary_location_id && (
            <div>
              <label htmlFor="location_details" className="label">
                Precision sur le lieu
              </label>
              <input
                id="location_details"
                name="location_details"
                type="text"
                value={formData.location_details}
                onChange={handleChange}
                className="input"
                placeholder="Ex: Bureau 201, Allee 5, Machine n°12..."
              />
            </div>
          )}
        </div>

        {/* Niveau d'urgence propose */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Niveau d'urgence propose</h2>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <HelpCircle className="w-4 h-4" />
              Sera valide par votre responsable
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {urgencyOptions.map((option) => (
              <label
                key={option.value}
                className={clsx(
                  'relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all',
                  formData.proposed_urgency === option.value
                    ? option.color
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

        {/* Impact sur l'activite */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Impact sur l'activite</h2>

          <div className="space-y-3">
            {blockingOptions.map((option) => (
              <label
                key={option.value}
                className={clsx(
                  'flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all',
                  formData.proposed_blocking === option.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="radio"
                  name="proposed_blocking"
                  value={option.value}
                  checked={formData.proposed_blocking === option.value}
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

          <div>
            <label htmlFor="impact_description" className="label">
              Description de l'impact
            </label>
            <textarea
              id="impact_description"
              name="impact_description"
              value={formData.impact_description}
              onChange={handleChange}
              rows={2}
              className="input"
              placeholder="Decrivez l'impact sur votre activite (optionnel)"
            />
          </div>
        </div>

        {/* Options avancees */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between py-2"
          >
            <h2 className="font-semibold text-gray-900">Options avancees</h2>
            <span className={clsx(
              'text-gray-500 transition-transform',
              showAdvanced && 'rotate-180'
            )}>
              ▼
            </span>
          </button>

          {showAdvanced && (
            <div className="space-y-4 mt-4 pt-4 border-t">
              {/* Recurrence */}
              <div>
                <label className="label">Recurrence du probleme</label>
                <div className="grid sm:grid-cols-2 gap-2">
                  {recurrenceOptions.map((option) => (
                    <label
                      key={option.value}
                      className={clsx(
                        'flex items-start p-3 rounded-lg border cursor-pointer transition-all',
                        formData.recurrence === option.value
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <input
                        type="radio"
                        name="recurrence"
                        value={option.value}
                        checked={formData.recurrence === option.value}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-sm text-gray-900">{option.label}</p>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {formData.recurrence !== 'ponctuel' && (
                  <div className="mt-3">
                    <label htmlFor="recurrence_details" className="label">
                      Details sur la recurrence
                    </label>
                    <input
                      id="recurrence_details"
                      name="recurrence_details"
                      type="text"
                      value={formData.recurrence_details}
                      onChange={handleChange}
                      className="input"
                      placeholder="Ex: Tous les lundis, A chaque demarrage..."
                    />
                  </div>
                )}
              </div>

              {/* Contournement */}
              <div>
                <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    name="has_workaround"
                    checked={formData.has_workaround}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">J'ai trouve un contournement</p>
                    <p className="text-sm text-gray-500">Une solution temporaire permet de continuer l'activite</p>
                  </div>
                </label>

                {formData.has_workaround && (
                  <textarea
                    name="workaround"
                    value={formData.workaround}
                    onChange={handleChange}
                    rows={2}
                    className="input mt-3"
                    placeholder="Decrivez le contournement..."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Prochaine etape</p>
            <p className="text-blue-700">
              Apres creation, votre ticket sera transmis au niveau {currentLevel + 1} pour validation.
              Le niveau d'urgence final et les delais SLA seront definis lors de cette validation.
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
                Creer le ticket
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTicketPage;
