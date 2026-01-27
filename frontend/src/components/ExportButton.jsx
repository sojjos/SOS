import { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportsAPI } from '../services/api';
import clsx from 'clsx';

function ExportButton({
  type = 'tickets', // 'tickets' | 'stats'
  agencyId,
  filters = {},
  className
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('excel');

  const formats = [
    { id: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { id: 'csv', label: 'CSV', icon: FileText },
    { id: 'pdf', label: 'PDF', icon: FileText }
  ];

  const handleExport = async () => {
    if (!agencyId) {
      toast.error('Veuillez sélectionner une agence');
      return;
    }

    setIsExporting(true);

    try {
      let response;

      if (type === 'tickets') {
        response = await exportsAPI.exportTickets({
          agency_id: agencyId,
          format: selectedFormat,
          filters
        });
      } else {
        response = await exportsAPI.exportStats({
          agency_id: agencyId,
          format: selectedFormat,
          period: filters.period || '30days'
        });
      }

      // Télécharger le fichier
      const downloadResponse = await exportsAPI.download(response.data.export_id);

      // Créer le lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([downloadResponse.data]));
      const link = document.createElement('a');
      link.href = url;

      const ext = selectedFormat === 'excel' ? 'xlsx' : selectedFormat;
      link.setAttribute('download', `export-${type}-${Date.now()}.${ext}`);

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Export téléchargé avec succès');
      setIsOpen(false);
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de l\'export';
      toast.error(errorMessage);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx('btn btn-secondary flex items-center gap-2', className)}
        disabled={isExporting}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Exporter
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border z-20">
            <div className="p-3 border-b">
              <p className="text-sm font-medium text-gray-700">Format d'export</p>
            </div>

            <div className="p-2">
              {formats.map(format => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedFormat === format.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  )}
                >
                  <format.icon className="w-4 h-4" />
                  {format.label}
                </button>
              ))}
            </div>

            <div className="p-2 border-t">
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Export en cours...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Télécharger
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ExportButton;
