import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Tag,
  MapPin,
  Clock,
  Lock,
  Plus,
  Edit,
  Trash2,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agenciesAPI, adminAPI } from '../../services/api';
import clsx from 'clsx';

function AgencyConfig() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agency, setAgency] = useState(null);
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [isLoading, setIsLoading] = useState(true);

  // Données de configuration
  const [hierarchyLevels, setHierarchyLevels] = useState([]);
  const [problemTypes, setProblemTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [slaConfigs, setSlaConfigs] = useState([]);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [agencyRes, levelsRes, typesRes, locsRes, slaRes] = await Promise.all([
        agenciesAPI.get(id),
        adminAPI.getHierarchyLevels(id),
        adminAPI.getProblemTypes(id),
        adminAPI.getLocations(id),
        adminAPI.getSlaConfigs(id)
      ]);

      setAgency(agencyRes.data);
      setHierarchyLevels(levelsRes.data);
      setProblemTypes(typesRes.data);
      setLocations(locsRes.data);
      setSlaConfigs(slaRes.data);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'hierarchy', label: 'Niveaux hiérarchiques', icon: Users },
    { id: 'types', label: 'Types de problèmes', icon: Tag },
    { id: 'locations', label: 'Lieux', icon: MapPin },
    { id: 'sla', label: 'SLA', icon: Clock }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/agencies')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Configuration - {agency?.name}
          </h1>
          <p className="text-gray-600">Code: {agency?.code}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu */}
      {activeTab === 'hierarchy' && (
        <HierarchyConfig
          agencyId={id}
          levels={hierarchyLevels}
          onReload={loadData}
        />
      )}
      {activeTab === 'types' && (
        <ProblemTypesConfig
          agencyId={id}
          types={problemTypes}
          onReload={loadData}
        />
      )}
      {activeTab === 'locations' && (
        <LocationsConfig
          agencyId={id}
          locations={locations}
          onReload={loadData}
        />
      )}
      {activeTab === 'sla' && (
        <SLAConfig
          configs={slaConfigs}
          onReload={loadData}
        />
      )}
    </div>
  );
}

// Configuration des niveaux hiérarchiques
function HierarchyConfig({ agencyId, levels, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    level_number: 0,
    name: '',
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await adminAPI.updateHierarchyLevel(editingId, formData);
        toast.success('Niveau mis à jour');
      } else {
        await adminAPI.createHierarchyLevel(agencyId, formData);
        toast.success('Niveau créé');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ level_number: 0, name: '', description: '' });
      onReload();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Ajouter un niveau
        </button>
      </div>

      {levels.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun niveau hiérarchique configuré
        </div>
      ) : (
        <div className="space-y-2">
          {levels.sort((a, b) => a.level_number - b.level_number).map((level) => (
            <div key={level.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">
                    {level.level_number}
                  </span>
                  <span className="font-medium">{level.name}</span>
                </div>
                {level.description && (
                  <p className="text-sm text-gray-500 mt-1 ml-10">{level.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setFormData(level);
                  setEditingId(level.id);
                  setShowForm(true);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? 'Modifier le niveau' : 'Nouveau niveau'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Numéro de niveau</label>
                <input
                  type="number"
                  value={formData.level_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, level_number: parseInt(e.target.value) }))}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="label">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  placeholder="Ex: Chef d'équipe"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  {editingId ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Configuration des types de problèmes
function ProblemTypesConfig({ agencyId, types, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', color: '#6c757d', icon: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createProblemType(agencyId, formData);
      toast.success('Type créé');
      setShowForm(false);
      setFormData({ name: '', description: '', color: '#6c757d', icon: '' });
      onReload();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un type
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((type) => (
          <div key={type.id} className="card">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
                style={{ backgroundColor: type.color }}
              >
                {type.icon || type.name[0]}
              </div>
              <div>
                <p className="font-medium">{type.name}</p>
                {type.description && (
                  <p className="text-sm text-gray-500">{type.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Nouveau type de problème</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Couleur</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
              <div>
                <label className="label">Icône (emoji)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                  className="input"
                  placeholder="Ex: 🔧"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary flex-1">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Configuration des lieux
function LocationsConfig({ agencyId, locations, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', location_type: 'terrain' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createLocation(agencyId, formData);
      toast.success('Lieu créé');
      setShowForm(false);
      setFormData({ name: '', location_type: 'terrain' });
      onReload();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  const groupedLocations = locations.reduce((acc, loc) => {
    if (!acc[loc.location_type]) acc[loc.location_type] = [];
    acc[loc.location_type].push(loc);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un lieu
        </button>
      </div>

      {Object.entries(groupedLocations).map(([type, locs]) => (
        <div key={type} className="card">
          <h3 className="font-semibold text-gray-900 mb-3 capitalize">{type}</h3>
          <div className="flex flex-wrap gap-2">
            {locs.map((loc) => (
              <span key={loc.id} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                {loc.name}
              </span>
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Nouveau lieu</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Type</label>
                <select
                  value={formData.location_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, location_type: e.target.value }))}
                  className="input"
                >
                  <option value="terrain">Terrain</option>
                  <option value="administratif">Administratif</option>
                  <option value="commun">Commun</option>
                  <option value="exterieur">Extérieur</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary flex-1">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Configuration des SLA
function SLAConfig({ configs, onReload }) {
  const urgencyLabels = { critique: 'Critique', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };
  const blockingLabels = { bloquant: 'Bloquant', partiel: 'Partiel', non_bloquant: 'Non bloquant' };

  const handleUpdate = async (id, field, value) => {
    try {
      await adminAPI.updateSlaConfig(id, { [field]: parseInt(value) });
      toast.success('SLA mis à jour');
      onReload();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-gray-500 border-b">
            <th className="pb-3 font-medium">Urgence</th>
            <th className="pb-3 font-medium">Niveau blocage</th>
            <th className="pb-3 font-medium">Réponse (heures)</th>
            <th className="pb-3 font-medium">Résolution (heures)</th>
          </tr>
        </thead>
        <tbody>
          {configs.map((config) => (
            <tr key={config.id} className="border-b last:border-0">
              <td className="py-3 font-medium">{urgencyLabels[config.urgency]}</td>
              <td className="py-3">{blockingLabels[config.blocking_level]}</td>
              <td className="py-3">
                <input
                  type="number"
                  defaultValue={config.response_time_hours}
                  onBlur={(e) => handleUpdate(config.id, 'response_time_hours', e.target.value)}
                  className="input w-24"
                  min="1"
                />
              </td>
              <td className="py-3">
                <input
                  type="number"
                  defaultValue={config.resolution_time_hours}
                  onBlur={(e) => handleUpdate(config.id, 'resolution_time_hours', e.target.value)}
                  className="input w-24"
                  min="1"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AgencyConfig;
