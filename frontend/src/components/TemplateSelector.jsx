import { useState, useEffect } from 'react';
import { FileText, ChevronDown, Star, Zap, Clock } from 'lucide-react';
import { templatesAPI } from '../services/api';
import clsx from 'clsx';

function TemplateSelector({ agencyId, onSelect, profileType }) {
  const [templates, setTemplates] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    if (agencyId) {
      loadTemplates();
    }
  }, [agencyId, profileType]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const response = await templatesAPI.list(agencyId);
      // Filtrer par profile_type si specifie
      const filtered = profileType
        ? response.data.filter(t => t.profile_type === profileType)
        : response.data;
      setTemplates(filtered);
    } catch (error) {
      console.error('Erreur chargement templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (template) => {
    setSelectedTemplate(template);
    setIsOpen(false);
    onSelect(template);
  };

  const getUrgencyBadge = (urgency) => {
    const styles = {
      critique: 'bg-red-100 text-red-700',
      haute: 'bg-orange-100 text-orange-700',
      moyenne: 'bg-yellow-100 text-yellow-700',
      basse: 'bg-green-100 text-green-700'
    };
    return styles[urgency] || 'bg-gray-100 text-gray-700';
  };

  if (templates.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="relative mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <FileText className="w-4 h-4 inline mr-2" />
        Utiliser un template
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between px-4 py-3 border rounded-lg bg-white transition-colors',
          isOpen ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <div className="flex items-center gap-2">
          {selectedTemplate ? (
            <>
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">{selectedTemplate.name}</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Selectionner un template...</span>
            </>
          )}
        </div>
        <ChevronDown className={clsx(
          'w-5 h-5 text-gray-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              Aucun template disponible
            </div>
          ) : (
            <ul>
              {/* Option pour ne pas utiliser de template */}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setIsOpen(false);
                    onSelect(null);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b flex items-center gap-2"
                >
                  <span className="text-gray-400">&#x2715;</span>
                  <span className="text-gray-600">Ne pas utiliser de template</span>
                </button>
              </li>

              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(template)}
                    className={clsx(
                      'w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0',
                      selectedTemplate?.id === template.id && 'bg-primary-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className={clsx(
                          'w-4 h-4',
                          template.usage_count > 10 ? 'text-yellow-500' : 'text-gray-300'
                        )} />
                        <span className="font-medium text-gray-900">{template.name}</span>
                      </div>
                      {template.default_urgency && (
                        <span className={clsx(
                          'text-xs px-2 py-0.5 rounded-full',
                          getUrgencyBadge(template.default_urgency)
                        )}>
                          {template.default_urgency}
                        </span>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1 ml-6">{template.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 ml-6 text-xs text-gray-400">
                      {template.problem_type_name && (
                        <span>Type: {template.problem_type_name}</span>
                      )}
                      {template.location_name && (
                        <span>Lieu: {template.location_name}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {template.usage_count} utilisations
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedTemplate && (
        <p className="mt-2 text-sm text-gray-500">
          Ce template pre-remplira certains champs du formulaire.
        </p>
      )}
    </div>
  );
}

export default TemplateSelector;
