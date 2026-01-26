import { useState } from 'react';
import { User, Mail, Lock, Save, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { notificationsAPI } from '../services/api';
import clsx from 'clsx';

function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  // Formulaire profil
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Formulaire mot de passe
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Préférences notifications
  const [notifPrefs, setNotifPrefs] = useState({
    email_new_ticket: true,
    email_ticket_assigned: true,
    email_ticket_updated: true,
    email_ticket_escalated: true,
    email_ticket_resolved: true,
    email_comment_added: true,
    email_sla_warning: true
  });
  const [isSavingNotifs, setIsSavingNotifs] = useState(false);

  // Sauvegarder le profil
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);

    const result = await updateProfile(profileData);

    if (result.success) {
      toast.success('Profil mis à jour');
    } else {
      toast.error(result.error);
    }

    setIsSavingProfile(false);
  };

  // Changer le mot de passe
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setIsSavingPassword(true);

    const result = await changePassword(passwordData.current_password, passwordData.new_password);

    if (result.success) {
      toast.success('Mot de passe modifié');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } else {
      toast.error(result.error);
    }

    setIsSavingPassword(false);
  };

  // Sauvegarder les préférences notifications
  const handleSaveNotifs = async () => {
    setIsSavingNotifs(true);

    try {
      await notificationsAPI.updatePreferences(notifPrefs);
      toast.success('Préférences sauvegardées');
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }

    setIsSavingNotifs(false);
  };

  const tabs = [
    { id: 'profile', label: 'Profil', icon: User },
    { id: 'password', label: 'Mot de passe', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon compte</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition-colors',
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
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="card space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-semibold text-primary-700">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {user?.first_name} {user?.last_name}
              </h2>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="label">Prénom</label>
              <input
                id="first_name"
                type="text"
                value={profileData.first_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="last_name" className="label">Nom</label>
              <input
                id="last_name"
                type="text"
                value={profileData.last_name}
                onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-gray-600">
              <Mail className="w-5 h-5" />
              {user?.email}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              L'email ne peut pas être modifié. Contactez un administrateur si nécessaire.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSavingProfile ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Changer le mot de passe</h2>

          <div>
            <label htmlFor="current_password" className="label">Mot de passe actuel</label>
            <input
              id="current_password"
              type="password"
              value={passwordData.current_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="new_password" className="label">Nouveau mot de passe</label>
            <input
              id="new_password"
              type="password"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
          </div>

          <div>
            <label htmlFor="confirm_password" className="label">Confirmer le mot de passe</label>
            <input
              id="confirm_password"
              type="password"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
              className="input"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSavingPassword}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSavingPassword ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Modifier
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'notifications' && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Préférences de notification</h2>
          <p className="text-sm text-gray-600">
            Choisissez les notifications que vous souhaitez recevoir par email.
          </p>

          <div className="space-y-3">
            {[
              { key: 'email_new_ticket', label: 'Nouveau ticket créé' },
              { key: 'email_ticket_assigned', label: 'Ticket assigné' },
              { key: 'email_ticket_updated', label: 'Ticket mis à jour' },
              { key: 'email_ticket_escalated', label: 'Ticket escaladé' },
              { key: 'email_ticket_resolved', label: 'Ticket résolu' },
              { key: 'email_comment_added', label: 'Nouveau commentaire' },
              { key: 'email_sla_warning', label: 'Alerte SLA' }
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                <span className="text-gray-700">{item.label}</span>
                <input
                  type="checkbox"
                  checked={notifPrefs[item.key]}
                  onChange={(e) => setNotifPrefs(prev => ({ ...prev, [item.key]: e.target.checked }))}
                  className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </label>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotifs}
              disabled={isSavingNotifs}
              className="btn btn-primary flex items-center gap-2"
            >
              {isSavingNotifs ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Infos compte */}
      <div className="card mt-6">
        <h3 className="font-semibold text-gray-900 mb-3">Informations du compte</h3>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Type de compte</dt>
            <dd className="font-medium">{user?.account_type}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Statut</dt>
            <dd className="font-medium">
              {user?.is_active ? (
                <span className="text-green-600">Actif</span>
              ) : (
                <span className="text-red-600">Inactif</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default ProfilePage;
