import { useState, useEffect } from 'react';
import { Search, Filter, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { adminAPI } from '../../services/api';
import clsx from 'clsx';

function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    entity_type: '',
    action: ''
  });

  useEffect(() => {
    loadLogs();
  }, [filters]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v)
      );
      const response = await adminAPI.getLogs(params);
      setLogs(response.data);
    } catch (error) {
      console.error('Erreur chargement logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const entityTypes = ['agency', 'user', 'hierarchy_level', 'problem_type', 'location', 'sla_config'];
  const actions = ['CREATE', 'UPDATE', 'DELETE', 'RESET_PASSWORD'];

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'RESET_PASSWORD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Logs administrateur</h1>
        <p className="text-gray-600">Historique des actions administratives</p>
      </div>

      {/* Filtres */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={filters.entity_type}
            onChange={(e) => setFilters(prev => ({ ...prev, entity_type: e.target.value }))}
            className="input w-auto"
          >
            <option value="">Tous les types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
            className="input w-auto"
          >
            <option value="">Toutes les actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          <button
            onClick={() => setFilters({ entity_type: '', action: '' })}
            className="btn btn-secondary"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun log trouvé</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={clsx('badge', getActionColor(log.action))}>
                      {log.action}
                    </span>
                    <span className="badge bg-gray-100 text-gray-800">
                      {log.entity_type}
                    </span>
                  </div>
                  <p className="text-gray-900">
                    <span className="font-medium">{log.admin_first_name} {log.admin_last_name}</span>
                    {' '}({log.admin_email})
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {format(new Date(log.created_at), 'dd MMM yyyy', { locale: fr })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(log.created_at), 'HH:mm:ss', { locale: fr })}
                  </p>
                  {log.ip_address && (
                    <p className="text-xs text-gray-400 mt-1">IP: {log.ip_address}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminLogs;
