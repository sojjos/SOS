import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Verifier si deja installe
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Detecter iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Ecouter l'evenement beforeinstallprompt (Android/Chrome)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Afficher le prompt apres un delai si l'utilisateur ne l'a pas refuse
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 30000); // 30 secondes
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Sur iOS, afficher les instructions manuelles
    if (iOS && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 30000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Ne pas afficher si deja installe
  if (isStandalone || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-xl border p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-full">
          <Smartphone className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">Installer SOS</h4>
          {isIOS ? (
            <div className="text-sm text-gray-600 mt-1">
              <p>Installez SOS sur votre appareil :</p>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Appuyez sur le bouton <strong>Partager</strong> <span className="text-lg">&#8593;</span></li>
                <li>Faites defiler et appuyez sur <strong>"Sur l'ecran d'accueil"</strong></li>
              </ol>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              Installez l'application SOS sur votre appareil pour un acces rapide, meme hors ligne.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {!isIOS && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Installer
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isIOS ? 'Fermer' : 'Plus tard'}
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
