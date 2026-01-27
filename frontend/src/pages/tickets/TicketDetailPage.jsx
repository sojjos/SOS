import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  EyeOff,
  User,
  MapPin,
  Tag,
  Lock,
  ArrowUp,
  ArrowDown,
  Play,
  XCircle,
  History,
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useAuthStore from '../../store/authStore';
import { ticketsAPI, agenciesAPI } from '../../services/api';
import clsx from 'clsx';

function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentAgency, getCurrentLevel, user } = useAuthStore();

  const [ticket, setTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [confidentialityGroups, setConfidentialityGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Formulaire de validation/action
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [actionData, setActionData] = useState({
    validated_urgency: '',
    validated_blocking: 'non_bloquant',
    urgency_justification: '',
    action: 'take_charge',
    escalation_reason: '',
    return_reason: '',
    resolution_type: '',
    resolution_description: ''
  });

  // Formulaire de commentaire
  const [newComment, setNewComment] = useState('');
  const [commentConfidentiality, setCommentConfidentiality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Onglet actif (details, history)
  const [activeTab, setActiveTab] = useState('details');

  const currentLevel = getCurrentLevel();

  // Charger le ticket
  useEffect(() => {
    const loadTicket = async () => {
      try {
        const [ticketRes, groupsRes] = await Promise.all([
          ticketsAPI.get(id),
          currentAgency ? agenciesAPI.getConfig(currentAgency.id).then(r => r.data.confidentialityGroups || []).catch(() => []) : Promise.resolve([])
        ]);

        const ticketData = ticketRes.data;
        setTicket(ticketData);
        setComments(ticketData.comments || []);
        setHistory(ticketData.history || []);
        setEscalations(ticketData.escalations || []);
        setConfidentialityGroups(groupsRes);
        setActionData(prev => ({
          ...prev,
          validated_urgency: ticketData.validated_urgency || ticketData.proposed_urgency,
          validated_blocking: ticketData.validated_blocking || ticketData.proposed_blocking || 'non_bloquant'
        }));
      } catch (error) {
        console.error('Erreur chargement ticket:', error);
        toast.error('Ticket non trouve');
        navigate('/tickets');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [id, currentAgency, navigate]);

  // Determiner le role de l'utilisateur par rapport au ticket
  const getUserRole = () => {
    if (!ticket || !user) return null;

    if (ticket.created_by === user.id) return 'creator';
    if (ticket.current_responsible === user.id) return 'responsible';
    if (currentLevel > (ticket.current_level || 0)) return 'validator';
    return 'viewer';
  };

  const userRole = getUserRole();

  // Verifier si l'utilisateur peut agir
  const canValidate = ticket?.status === 'en_attente_validation' && currentLevel > (ticket.current_level || 0);
  const canTakeAction = userRole === 'responsible' || (userRole === 'validator' && canValidate);
  const canChangeStatus = ticket?.current_responsible === user?.id || currentLevel >= 2;
  const canToggleUnion = currentLevel >= 2;
  const canEscalate = currentLevel > 0 && ticket?.status !== 'cloture' && ticket?.status !== 'annule';
  const canResolve = ticket?.status !== 'cloture' && ticket?.status !== 'annule' && ticket?.status !== 'resolu';

  // Valider le ticket avec action
  const handleValidate = async () => {
    setIsSubmitting(true);
    try {
      const response = await ticketsAPI.validate(id, {
        validated_urgency: actionData.validated_urgency,
        validated_blocking: actionData.validated_blocking,
        urgency_justification: actionData.urgency_justification,
        action: actionData.action,
        escalation_reason: actionData.escalation_reason,
        return_reason: actionData.return_reason
      });
      setTicket(response.data);
      setShowActionPanel(false);

      const messages = {
        take_charge: 'Ticket pris en charge',
        escalate: 'Ticket escalade au niveau superieur',
        return: 'Ticket retourne au createur'
      };
      toast.success(messages[actionData.action] || 'Action effectuee');

      // Recharger l'historique
      const historyRes = await ticketsAPI.getHistory(id);
      setHistory(historyRes.data || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'action');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Changer le statut
  const handleStatusChange = async (newStatus, extraData = {}) => {
    setIsSubmitting(true);
    try {
      const response = await ticketsAPI.updateStatus(id, {
        status: newStatus,
        ...extraData
      });
      setTicket(response.data);
      toast.success('Statut mis a jour');

      // Recharger l'historique
      const historyRes = await ticketsAPI.getHistory(id);
      setHistory(historyRes.data || []);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise a jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resoudre le ticket
  const handleResolve = async () => {
    if (!actionData.resolution_description) {
      toast.error('Veuillez decrire la resolution');
      return;
    }
    await handleStatusChange('resolu', {
      resolution_type: actionData.resolution_type || 'resolved',
      resolution_description: actionData.resolution_description
    });
    setShowActionPanel(false);
  };

  // Ajouter un commentaire
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await ticketsAPI.addComment(id, {
        content: newComment,
        confidentiality_group_id: commentConfidentiality || null
      });

      setComments([...comments, response.data]);
      setNewComment('');
      setCommentConfidentiality('');
      toast.success('Commentaire ajoute');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle visibilite syndicat
  const handleToggleUnion = async () => {
    try {
      const response = await ticketsAPI.toggleUnionVisibility(id, !ticket.is_visible_union);
      setTicket(response.data);
      toast.success(response.data.is_visible_union ? 'Visible au syndicat' : 'Masque au syndicat');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const statusConfig = {
    nouveau: { label: 'Nouveau', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
    en_attente_validation: { label: 'En attente validation', color: 'bg-orange-100 text-orange-800', icon: Clock },
    valide: { label: 'Valide', color: 'bg-purple-100 text-purple-800', icon: CheckCircle },
    en_analyse: { label: 'En analyse', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
    en_cours: { label: 'En cours', color: 'bg-cyan-100 text-cyan-800', icon: Play },
    resolu: { label: 'Resolu', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    cloture: { label: 'Cloture', color: 'bg-gray-100 text-gray-800', icon: XCircle },
    annule: { label: 'Annule', color: 'bg-red-100 text-red-800', icon: XCircle }
  };

  const urgencyConfig = {
    critique: { label: 'Critique', color: 'bg-red-100 text-red-800 border-red-200' },
    haute: { label: 'Haute', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    moyenne: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    basse: { label: 'Basse', color: 'bg-green-100 text-green-800 border-green-200' }
  };

  const blockingConfig = {
    bloquant: { label: 'Bloquant', color: 'bg-red-100 text-red-800' },
    partiel: { label: 'Partiellement bloquant', color: 'bg-orange-100 text-orange-800' },
    non_bloquant: { label: 'Non bloquant', color: 'bg-green-100 text-green-800' }
  };

  const currentUrgency = ticket.validated_urgency || ticket.proposed_urgency;
  const currentBlocking = ticket.validated_blocking || ticket.proposed_blocking;
  const StatusIcon = statusConfig[ticket.status]?.icon || AlertCircle;

  // Rendu de l'indicateur de role
  const RoleIndicator = () => {
    const roleConfig = {
      creator: { label: 'Vous avez cree ce ticket', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
      responsible: { label: 'Vous etes responsable de ce ticket', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
      validator: { label: 'Ce ticket attend votre validation', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
      viewer: { label: 'Consultation', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' }
    };

    const config = roleConfig[userRole] || roleConfig.viewer;

    return (
      <div className={clsx('px-4 py-2 rounded-lg border', config.bg, config.border)}>
        <p className={clsx('text-sm font-medium', config.text)}>
          {config.label}
          {ticket.current_level_name && (
            <span className="ml-2 text-xs opacity-75">
              (En charge: {ticket.current_level_name})
            </span>
          )}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <p className="text-gray-600">{ticket.ticket_number || ticket.reference}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx('badge flex items-center gap-1', statusConfig[ticket.status]?.color)}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig[ticket.status]?.label}
              </span>
              <span className={clsx('badge border', urgencyConfig[currentUrgency]?.color)}>
                {urgencyConfig[currentUrgency]?.label}
              </span>
              {currentBlocking && (
                <span className={clsx('badge', blockingConfig[currentBlocking]?.color)}>
                  {blockingConfig[currentBlocking]?.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Indicateur de role */}
      <RoleIndicator />

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={clsx(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'details'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2',
              activeTab === 'history'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <History className="w-4 h-4" />
            Historique
            {history.length > 0 && (
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {activeTab === 'details' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Panneau d'action pour validation/escalade */}
            {canValidate && !showActionPanel && (
              <div className="card border-orange-200 bg-orange-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-900">Action requise</h3>
                      <p className="text-sm text-orange-700">Ce ticket attend votre decision</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowActionPanel(true)}
                    className="btn btn-primary"
                  >
                    Traiter
                  </button>
                </div>
              </div>
            )}

            {/* Panneau d'actions etendu */}
            {showActionPanel && (
              <div className="card border-primary-200 bg-primary-50">
                <h3 className="font-semibold text-gray-900 mb-4">Actions sur le ticket</h3>

                <div className="space-y-4">
                  {/* Evaluation de l'urgence */}
                  <div className="p-4 bg-white rounded-lg border">
                    <h4 className="font-medium text-gray-900 mb-3">Evaluer l'urgence</h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Niveau d'urgence</label>
                        <select
                          value={actionData.validated_urgency}
                          onChange={(e) => setActionData(prev => ({ ...prev, validated_urgency: e.target.value }))}
                          className="input"
                        >
                          <option value="basse">Basse</option>
                          <option value="moyenne">Moyenne</option>
                          <option value="haute">Haute</option>
                          <option value="critique">Critique</option>
                        </select>
                        {actionData.validated_urgency !== (ticket.proposed_urgency) && (
                          <p className="text-xs text-orange-600 mt-1">
                            Propose: {ticket.proposed_urgency}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="label">Niveau de blocage</label>
                        <select
                          value={actionData.validated_blocking}
                          onChange={(e) => setActionData(prev => ({ ...prev, validated_blocking: e.target.value }))}
                          className="input"
                        >
                          <option value="non_bloquant">Non bloquant</option>
                          <option value="partiel">Partiellement bloquant</option>
                          <option value="bloquant">Bloquant</option>
                        </select>
                      </div>
                    </div>
                    {actionData.validated_urgency !== ticket.proposed_urgency && (
                      <div className="mt-3">
                        <label className="label">Justification du changement</label>
                        <textarea
                          value={actionData.urgency_justification}
                          onChange={(e) => setActionData(prev => ({ ...prev, urgency_justification: e.target.value }))}
                          className="input"
                          rows={2}
                          placeholder="Expliquez pourquoi vous modifiez l'urgence..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Choix de l'action */}
                  <div className="p-4 bg-white rounded-lg border">
                    <h4 className="font-medium text-gray-900 mb-3">Choisir une action</h4>
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="action"
                          value="take_charge"
                          checked={actionData.action === 'take_charge'}
                          onChange={(e) => setActionData(prev => ({ ...prev, action: e.target.value }))}
                          className="mt-1"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <Play className="w-4 h-4 text-green-600" />
                            <span className="font-medium">Prendre en charge</span>
                          </div>
                          <p className="text-sm text-gray-500">Je m'occupe de ce ticket</p>
                        </div>
                      </label>

                      {canEscalate && (
                        <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="radio"
                            name="action"
                            value="escalate"
                            checked={actionData.action === 'escalate'}
                            onChange={(e) => setActionData(prev => ({ ...prev, action: e.target.value }))}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <ArrowUp className="w-4 h-4 text-orange-600" />
                              <span className="font-medium">Escalader</span>
                            </div>
                            <p className="text-sm text-gray-500">Remonter au niveau superieur</p>
                            {actionData.action === 'escalate' && (
                              <textarea
                                value={actionData.escalation_reason}
                                onChange={(e) => setActionData(prev => ({ ...prev, escalation_reason: e.target.value }))}
                                className="input mt-2"
                                rows={2}
                                placeholder="Raison de l'escalade..."
                              />
                            )}
                          </div>
                        </label>
                      )}

                      <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          name="action"
                          value="return"
                          checked={actionData.action === 'return'}
                          onChange={(e) => setActionData(prev => ({ ...prev, action: e.target.value }))}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-gray-600" />
                            <span className="font-medium">Retourner</span>
                          </div>
                          <p className="text-sm text-gray-500">Renvoyer au createur pour plus d'infos</p>
                          {actionData.action === 'return' && (
                            <textarea
                              value={actionData.return_reason}
                              onChange={(e) => setActionData(prev => ({ ...prev, return_reason: e.target.value }))}
                              className="input mt-2"
                              rows={2}
                              placeholder="Information manquante..."
                            />
                          )}
                        </div>
                      </label>

                      {canResolve && (
                        <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                          <input
                            type="radio"
                            name="action"
                            value="resolve"
                            checked={actionData.action === 'resolve'}
                            onChange={(e) => setActionData(prev => ({ ...prev, action: e.target.value }))}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="font-medium">Resoudre</span>
                            </div>
                            <p className="text-sm text-gray-500">Marquer comme resolu</p>
                            {actionData.action === 'resolve' && (
                              <div className="mt-2 space-y-2">
                                <select
                                  value={actionData.resolution_type}
                                  onChange={(e) => setActionData(prev => ({ ...prev, resolution_type: e.target.value }))}
                                  className="input"
                                >
                                  <option value="">Type de resolution...</option>
                                  <option value="resolved">Resolu</option>
                                  <option value="workaround">Contournement</option>
                                  <option value="duplicate">Doublon</option>
                                  <option value="wont_fix">Ne sera pas corrige</option>
                                </select>
                                <textarea
                                  value={actionData.resolution_description}
                                  onChange={(e) => setActionData(prev => ({ ...prev, resolution_description: e.target.value }))}
                                  className="input"
                                  rows={2}
                                  placeholder="Description de la resolution..."
                                  required
                                />
                              </div>
                            )}
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Boutons */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowActionPanel(false)}
                      className="btn btn-secondary"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={actionData.action === 'resolve' ? handleResolve : handleValidate}
                      disabled={isSubmitting || (actionData.action === 'escalate' && !actionData.escalation_reason)}
                      className="btn btn-primary"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Confirmer'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions rapides pour le responsable */}
            {!showActionPanel && canChangeStatus && ticket.status !== 'cloture' && ticket.status !== 'annule' && userRole === 'responsible' && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Actions rapides</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowActionPanel(true)}
                    className="btn btn-secondary flex items-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Re-evaluer / Escalader
                  </button>

                  {ticket.status === 'valide' && (
                    <button
                      onClick={() => handleStatusChange('en_cours')}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Demarrer le traitement
                    </button>
                  )}

                  {(ticket.status === 'en_cours' || ticket.status === 'en_analyse') && (
                    <button
                      onClick={() => {
                        setActionData(prev => ({ ...prev, action: 'resolve' }));
                        setShowActionPanel(true);
                      }}
                      className="btn btn-success flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resoudre
                    </button>
                  )}

                  {ticket.status === 'resolu' && (
                    <button
                      onClick={() => handleStatusChange('cloture')}
                      className="btn btn-secondary flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cloturer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">
                {ticket.description || 'Aucune description fournie.'}
              </p>

              {ticket.impact_description && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium text-gray-900 mb-2">Impact</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{ticket.impact_description}</p>
                </div>
              )}

              {ticket.has_workaround && ticket.workaround && (
                <div className="mt-4 pt-4 border-t">
                  <h3 className="font-medium text-gray-900 mb-2">Contournement disponible</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{ticket.workaround}</p>
                </div>
              )}
            </div>

            {/* Escalades */}
            {escalations.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ArrowUp className="w-5 h-5" />
                  Escalades ({escalations.length})
                </h2>
                <div className="space-y-3">
                  {escalations.map((esc) => (
                    <div key={esc.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-orange-900">
                          Niveau {esc.from_level} → Niveau {esc.to_level}
                        </span>
                        <span className="text-xs text-orange-600">
                          {format(new Date(esc.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm text-orange-800">{esc.reason || 'Aucune raison specifiee'}</p>
                      <p className="text-xs text-orange-600 mt-1">Par {esc.from_user_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Commentaires */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">
                Commentaires ({comments.length})
              </h2>

              {/* Liste des commentaires */}
              <div className="space-y-4 mb-6">
                {comments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Aucun commentaire</p>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={clsx(
                        'p-4 rounded-lg',
                        comment.confidentiality_group_id ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-primary-700">
                              {comment.user_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {comment.user_name || 'Utilisateur'}
                              {comment.user_level_name && (
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  ({comment.user_level_name})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {format(new Date(comment.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        {comment.confidentiality_group_id && (
                          <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            {comment.confidentiality_group_name || 'Confidentiel'}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Formulaire nouveau commentaire */}
              <form onSubmit={handleAddComment} className="space-y-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Ajouter un commentaire..."
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {confidentialityGroups.length > 0 && (
                      <select
                        value={commentConfidentiality}
                        onChange={(e) => setCommentConfidentiality(e.target.value)}
                        className="input w-auto text-sm"
                      >
                        <option value="">Public</option>
                        {confidentialityGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim()}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Envoyer
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Colonne laterale */}
          <div className="space-y-6">
            {/* Informations */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">Informations</h3>
              <dl className="space-y-3">
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <dt className="text-sm text-gray-500">Type</dt>
                    <dd className="font-medium">{ticket.problem_type_name || '-'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <dt className="text-sm text-gray-500">Lieu</dt>
                    <dd className="font-medium">{ticket.location_name || '-'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <dt className="text-sm text-gray-500">Cree par</dt>
                    <dd className="font-medium">
                      {ticket.created_by_name || 'Inconnu'}
                      {ticket.created_at_level_name && (
                        <span className="text-xs text-gray-500 block">{ticket.created_at_level_name}</span>
                      )}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <dt className="text-sm text-gray-500">Cree le</dt>
                    <dd className="font-medium">
                      {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </dd>
                  </div>
                </div>
                {ticket.current_responsible && (
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <dt className="text-sm text-gray-500">Responsable actuel</dt>
                      <dd className="font-medium">
                        {ticket.responsible_name || 'Non assigne'}
                      </dd>
                    </div>
                  </div>
                )}
                {ticket.validated_by && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <dt className="text-sm text-gray-500">Valide par</dt>
                      <dd className="font-medium">
                        {ticket.validated_by_name || 'Inconnu'}
                        {ticket.validated_at && (
                          <span className="text-xs text-gray-500 block">
                            {format(new Date(ticket.validated_at), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                      </dd>
                    </div>
                  </div>
                )}
                {ticket.resolved_by && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    <div>
                      <dt className="text-sm text-gray-500">Resolu par</dt>
                      <dd className="font-medium">
                        {ticket.resolved_by_name || 'Inconnu'}
                        {ticket.resolved_at && (
                          <span className="text-xs text-gray-500 block">
                            {format(new Date(ticket.resolved_at), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        )}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>

            {/* Recurrence */}
            {ticket.recurrence && ticket.recurrence !== 'ponctuel' && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Recurrence</h3>
                <p className="text-gray-700 capitalize">{ticket.recurrence}</p>
                {ticket.recurrence_details && (
                  <p className="text-sm text-gray-500 mt-1">{ticket.recurrence_details}</p>
                )}
              </div>
            )}

            {/* SLA */}
            {ticket.sla_response_deadline && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">SLA</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Reponse</p>
                    <p className={clsx(
                      'font-medium',
                      new Date(ticket.sla_response_deadline) < new Date() && ticket.status !== 'resolu' && ticket.status !== 'cloture'
                        ? 'text-red-600'
                        : 'text-green-600'
                    )}>
                      {format(new Date(ticket.sla_response_deadline), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </div>
                  {ticket.sla_resolution_deadline && (
                    <div>
                      <p className="text-sm text-gray-500">Resolution</p>
                      <p className={clsx(
                        'font-medium',
                        new Date(ticket.sla_resolution_deadline) < new Date() && ticket.status !== 'resolu' && ticket.status !== 'cloture'
                          ? 'text-red-600'
                          : 'text-green-600'
                      )}>
                        {format(new Date(ticket.sla_resolution_deadline), 'dd MMM yyyy HH:mm', { locale: fr })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Visibilite syndicat */}
            {canToggleUnion && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Visibilite syndicat</h3>
                <button
                  onClick={handleToggleUnion}
                  className={clsx(
                    'w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors',
                    ticket.is_visible_union
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {ticket.is_visible_union ? (
                    <>
                      <Eye className="w-4 h-4" />
                      Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Non visible
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Onglet Historique */
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-6">Historique du ticket</h2>

          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun historique disponible</p>
          ) : (
            <div className="relative">
              {/* Ligne verticale */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

              <div className="space-y-6">
                {history.map((entry, index) => {
                  const actionConfig = {
                    created: { icon: AlertCircle, color: 'bg-blue-100 text-blue-600', label: 'Ticket cree' },
                    validated: { icon: CheckCircle, color: 'bg-green-100 text-green-600', label: 'Valide' },
                    status_changed: { icon: ChevronRight, color: 'bg-purple-100 text-purple-600', label: 'Statut modifie' },
                    escalated: { icon: ArrowUp, color: 'bg-orange-100 text-orange-600', label: 'Escalade' },
                    comment_added: { icon: Send, color: 'bg-gray-100 text-gray-600', label: 'Commentaire ajoute' },
                    visibility_changed: { icon: Eye, color: 'bg-cyan-100 text-cyan-600', label: 'Visibilite modifiee' },
                    assigned: { icon: User, color: 'bg-indigo-100 text-indigo-600', label: 'Assigne' }
                  };

                  const config = actionConfig[entry.action] || {
                    icon: AlertCircle,
                    color: 'bg-gray-100 text-gray-600',
                    label: entry.action
                  };
                  const ActionIcon = config.icon;

                  return (
                    <div key={entry.id} className="relative flex gap-4 pl-8">
                      {/* Point sur la timeline */}
                      <div className={clsx(
                        'absolute left-0 w-8 h-8 rounded-full flex items-center justify-center',
                        config.color
                      )}>
                        <ActionIcon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{config.label}</p>
                            <p className="text-sm text-gray-500">
                              {entry.user_name}
                              {entry.user_level_name && (
                                <span className="text-gray-400"> - {entry.user_level_name}</span>
                              )}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {format(new Date(entry.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </span>
                        </div>

                        {/* Details selon le type d'action */}
                        {entry.field_name && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-500">{entry.field_name}:</span>{' '}
                            {entry.old_value && (
                              <span className="line-through text-gray-400 mr-2">{entry.old_value}</span>
                            )}
                            <span className="text-gray-900">{entry.new_value}</span>
                          </div>
                        )}

                        {entry.details && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                            {typeof entry.details === 'string'
                              ? entry.details
                              : JSON.stringify(entry.details, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TicketDetailPage;
