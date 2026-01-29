import { useState, useEffect } from 'react';
import { Search, Filter, X, Calendar, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { agenciesAPI } from '../services/api';
import clsx from 'clsx';

function AdvancedSearch({ agencyId, onSearch, initialFilters = {} }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [problemTypes, setProblemTypes] = useState([]);
  const [locations, setLocations] = useState([]);

  const [filters, setFilters] = useState({
    search: '',
    status: '',
    urgency: '',
    blocking: '',
    problem_type_id: '',
    location_id: '',
    date_from: '',
    date_to: '',
    sla_exceeded: false,
    my_tickets: false,
    ...initialFilters
  });

  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Charger les types de problemes et lieux
  useEffect(() => {
    if (agencyId) {
      loadFilterOptions();
    }
  }, [agencyId]);

  // Compter les filtres actifs
  useEffect(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.urgency) count++;
    if (filters.blocking) count++;
    if (filters.problem_type_id) count++;
    if (filters.location_id) count++;
    if (filters.date_from) count++;
    if (filters.date_to) count++;
    if (filters.sla_exceeded) count++;
    if (filters.my_tickets) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  const loadFilterOptions = async () => {
    try {
      const [typesRes, locationsRes] = await Promise.all([
        agenciesAPI.getProblemTypes(agencyId),
        agenciesAPI.getLocations(agencyId)
      ]);
      setProblemTypes(typesRes.data);
      setLocations(locationsRes.data);
    } catch (error) {
      console.error('Erreur chargement options:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSearch = (e) => {
    e?.preventDefault();
    // Construire les params de recherche
    const searchParams = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== false) {
        searchParams[key] = value;
      }
    });
    onSearch(searchParams);
  };

  const handleReset = () => {
    const resetFilters = {
      search: '',
      status: '',
      urgency: '',
      blocking: '',
      problem_type_id: '',
      location_id: '',
      date_from: '',
      date_to: '',
      sla_exceeded: false,
      my_tickets: false
    };
    setFilters(resetFilters);
    onSearch({});
  };

  const handleQuickSearch = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const statusOptions = [
    { value: 'nouveau', label: 'Nouveau' },
    { value: 'en_attente_validation', label: 'En attente validation' },
    { value: 'en_analyse', label: 'En analyse' },
    { value: 'en_cours', label: 'En cours' },
    { value: 'resolu', label: 'Resolu' },
    { value: 'cloture', label: 'Cloture' }
  ];

  const urgencyOptions = [
    { value: 'critique', label: 'Critique', color: 'text-red-600' },
    { value: 'haute', label: 'Haute', color: 'text-orange-600' },
    { value: 'moyenne', label: 'Moyenne', color: 'text-yellow-600' },
    { value: 'basse', label: 'Basse', color: 'text-green-600' }
  ];

  const blockingOptions = [
    { value: 'bloquant', label: 'Bloquant' },
    { value: 'partiel', label: 'Partiellement bloquant' },
    { value: 'non_bloquant', label: 'Non bloquant' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-6">
      {/* Barre de recherche principale */}
      <div className="p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleChange}
              onKeyDown={handleQuickSearch}
              placeholder="Rechercher par titre, description, numero..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors',
              isExpanded || activeFiltersCount > 0
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-300 hover:bg-gray-50'
            )}
          >
            <Filter className="w-5 h-5" />
            <span>Filtres</span>
            {activeFiltersCount > 0 && (
              <span className="bg-primary-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleSearch}
            className="btn btn-primary flex items-center gap-2"
          >
            <Search className="w-5 h-5" />
            Rechercher
          </button>
        </div>
      </div>

      {/* Filtres avances */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t pt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Statut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleChange}
                className="input"
              >
                <option value="">Tous les statuts</option>
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Urgence */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgence</label>
              <select
                name="urgency"
                value={filters.urgency}
                onChange={handleChange}
                className="input"
              >
                <option value="">Toutes les urgences</option>
                {urgencyOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Niveau de blocage */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blocage</label>
              <select
                name="blocking"
                value={filters.blocking}
                onChange={handleChange}
                className="input"
              >
                <option value="">Tous les niveaux</option>
                {blockingOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Type de probleme */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de probleme</label>
              <select
                name="problem_type_id"
                value={filters.problem_type_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Tous les types</option>
                {problemTypes.map(pt => (
                  <option key={pt.id} value={pt.id}>{pt.name}</option>
                ))}
              </select>
            </div>

            {/* Lieu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
              <select
                name="location_id"
                value={filters.location_id}
                onChange={handleChange}
                className="input"
              >
                <option value="">Tous les lieux</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Date debut */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  name="date_from"
                  value={filters.date_from}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Date fin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  name="date_to"
                  value={filters.date_to}
                  onChange={handleChange}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Options rapides */}
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="sla_exceeded"
                  checked={filters.sla_exceeded}
                  onChange={handleChange}
                  className="w-4 h-4 text-red-600 rounded border-gray-300"
                />
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-700">SLA depasse</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="my_tickets"
                  checked={filters.my_tickets}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary-600 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Mes tickets uniquement</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Reinitialiser
            </button>
            <button
              type="button"
              onClick={handleSearch}
              className="btn btn-primary flex items-center gap-2"
            >
              <Search className="w-5 h-5" />
              Appliquer les filtres
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdvancedSearch;
