import { useState } from 'react';
import { HardHat, Briefcase, Users, Check } from 'lucide-react';
import clsx from 'clsx';

const PROFILE_TYPES = [
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Travail opérationnel sur le terrain',
    icon: HardHat,
    color: 'blue'
  },
  {
    id: 'administratif',
    label: 'Administratif',
    description: 'Travail administratif et bureautique',
    icon: Briefcase,
    color: 'purple'
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Gestion d\'équipe et supervision',
    icon: Users,
    color: 'green'
  }
];

function ProfileTypesSelector({ value = [], onChange, disabled = false, single = false }) {
  const handleToggle = (typeId) => {
    if (disabled) return;

    if (single) {
      onChange([typeId]);
    } else {
      if (value.includes(typeId)) {
        // Ne pas permettre de tout décocher
        if (value.length > 1) {
          onChange(value.filter(t => t !== typeId));
        }
      } else {
        onChange([...value, typeId]);
      }
    }
  };

  const colors = {
    blue: {
      selected: 'bg-blue-100 border-blue-500 text-blue-700',
      icon: 'bg-blue-500 text-white'
    },
    purple: {
      selected: 'bg-purple-100 border-purple-500 text-purple-700',
      icon: 'bg-purple-500 text-white'
    },
    green: {
      selected: 'bg-green-100 border-green-500 text-green-700',
      icon: 'bg-green-500 text-white'
    }
  };

  return (
    <div className="space-y-2">
      <label className="label">
        Types de profil {!single && '(casquettes)'}
      </label>
      <p className="text-sm text-gray-500 mb-3">
        {single
          ? 'Sélectionnez le type de profil principal'
          : 'Sélectionnez un ou plusieurs types de profil'
        }
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        {PROFILE_TYPES.map(type => {
          const isSelected = value.includes(type.id);
          const colorScheme = colors[type.color];

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleToggle(type.id)}
              disabled={disabled}
              className={clsx(
                'relative flex flex-col items-center p-4 rounded-lg border-2 transition-all',
                disabled && 'opacity-50 cursor-not-allowed',
                isSelected
                  ? colorScheme.selected
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4" />
                </div>
              )}

              {/* Icon */}
              <div className={clsx(
                'w-12 h-12 rounded-full flex items-center justify-center mb-2',
                isSelected ? colorScheme.icon : 'bg-gray-100 text-gray-500'
              )}>
                <type.icon className="w-6 h-6" />
              </div>

              {/* Label */}
              <span className="font-medium">{type.label}</span>
              <span className={clsx(
                'text-xs text-center mt-1',
                isSelected ? '' : 'text-gray-500'
              )}>
                {type.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Composant pour afficher les types de profil en lecture seule
export function ProfileTypesBadges({ types = [] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PROFILE_TYPES.filter(t => types.includes(t.id)).map(type => {
        const Icon = type.icon;
        const bgColors = {
          terrain: 'bg-blue-100 text-blue-700',
          administratif: 'bg-purple-100 text-purple-700',
          manager: 'bg-green-100 text-green-700'
        };

        return (
          <span
            key={type.id}
            className={clsx('badge flex items-center gap-1', bgColors[type.id])}
          >
            <Icon className="w-3 h-3" />
            {type.label}
          </span>
        );
      })}
    </div>
  );
}

// Fonction utilitaire pour obtenir le label d'un type
export function getProfileTypeLabel(typeId) {
  const type = PROFILE_TYPES.find(t => t.id === typeId);
  return type?.label || typeId;
}

export default ProfileTypesSelector;
