import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    // Ecouter les mises a jour du service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouvelle version disponible
                setShowPrompt(true);
                setRegistration(reg);
              }
            });
          }
        });
      });

      // Ecouter le message de mise a jour
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-xl border p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary-100 rounded-full">
          <RefreshCw className="w-5 h-5 text-primary-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">Mise a jour disponible</h4>
          <p className="text-sm text-gray-600 mt-1">
            Une nouvelle version de SOS est disponible. Mettez a jour pour profiter des dernieres fonctionnalites.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Mettre a jour
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowPrompt(false)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

export default PWAUpdatePrompt;
