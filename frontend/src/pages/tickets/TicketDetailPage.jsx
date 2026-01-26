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
  Lock
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
  const [confidentialityGroups, setConfidentialityGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Formulaire de validation
  const [showValidation, setShowValidation] = useState(false);
  const [validationData, setValidationData] = useState({
    urgency: '',
    action: 'take_charge'
  });

  // Formulaire de commentaire
  const [newComment, setNewComment] = useState('');
  const [commentConfidentiality, setCommentConfidentiality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentLevel = getCurrentLevel();

  // Charger le ticket
  useEffect(() => {
    const loadTicket = async () => {
      try {
        const [ticketRes, groupsRes] = await Promise.all([
          ticketsAPI.get(id),
          currentAgency ? agenciesAPI.getConfig(currentAgency.id).then(r => r.data.confidentialityGroups || []) : Promise.resolve([])
        ]);

        setTicket(ticketRes.data.ticket);
        setComments(ticketRes.data.comments || []);
        setConfidentialityGroups(groupsRes);
        setValidationData(prev => ({
          ...prev,
          urgency: ticketRes.data.ticket.proposed_urgency
        }));
      } catch (error) {
        console.error('Erreur chargement ticket:', error);
        toast.error('Ticket non trouvé');
        navigate('/tickets');
      } finally {
        setIsLoading(false);
      }
    };

    loadTicket();
  }, [id, currentAgency, navigate]);

  // Valider le ticket
  const handleValidate = async () => {
    setIsSubmitting(true);
    try {
      const response = await ticketsAPI.validate(id, validationData);
      setTicket(response.data);
      setShowValidation(false);
      toast.success('Ticket validé avec succès');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la validation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Changer le statut
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await ticketsAPI.updateStatus(id, { status: newStatus });
      setTicket(response.data);
      toast.success('Statut mis à jour');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de la mise à jour');
    }
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
      toast.success('Commentaire ajouté');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle visibilité syndicat
  const handleToggleUnion = async () => {
    try {
      const response = await ticketsAPI.toggleUnionVisibility(id, !ticket.visible_to_union);
      setTicket(response.data);
      toast.success(response.data.visible_to_union ? 'Visible au syndicat' : 'Masqué au syndicat');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Erreur');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const statusConfig = {
    ouvert: { label: 'Ouvert', color: 'bg-blue-100 text-blue-800' },
    en_attente_validation: { label: 'En attente validation', color: 'bg-orange-100 text-orange-800' },
    valide: { label: 'Validé', color: 'bg-purple-100 text-purple-800' },
    en_cours: { label: 'En cours', color: 'bg-cyan-100 text-cyan-800' },
    resolu: { label: 'Résolu', color: 'bg-green-100 text-green-800' },
    cloture: { label: 'Clôturé', color: 'bg-gray-100 text-gray-800' },
    annule: { label: 'Annulé', color: 'bg-red-100 text-red-800' }
  };

  const urgencyConfig = {
    critique: { label: 'Critique', color: 'bg-red-100 text-red-800' },
    haute: { label: 'Haute', color: 'bg-orange-100 text-orange-800' },
    moyenne: { label: 'Moyenne', color: 'bg-yellow-100 text-yellow-800' },
    basse: { label: 'Basse', color: 'bg-green-100 text-green-800' }
  };

  const canValidate = ticket.status === 'en_attente_validation' && currentLevel > (ticket.creator_level || 0);
  const canChangeStatus = ticket.assigned_to_id === user.id || currentLevel >= 2;
  const canToggleUnion = currentLevel >= 2;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{ticket.title}</h1>
              <p className="text-gray-600">{ticket.reference}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={clsx('badge', statusConfig[ticket.status].color)}>
                {statusConfig[ticket.status].label}
              </span>
              <span className={clsx('badge', urgencyConfig[ticket.urgency || ticket.proposed_urgency].color)}>
                {urgencyConfig[ticket.urgency || ticket.proposed_urgency].label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {ticket.description || 'Aucune description fournie.'}
            </p>
          </div>

          {/* Actions de validation */}
          {canValidate && (
            <div className="card border-orange-200 bg-orange-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-orange-900">Action requise</h3>
                  <p className="text-sm text-orange-700">Ce ticket est en attente de votre validation</p>
                </div>
                <button
                  onClick={() => setShowValidation(true)}
                  className="btn btn-primary"
                >
                  Valider
                </button>
              </div>

              {showValidation && (
                <div className="mt-4 pt-4 border-t border-orange-200 space-y-4">
                  <div>
                    <label className="label">Niveau d'urgence validé</label>
                    <select
                      value={validationData.urgency}
                      onChange={(e) => setValidationData(prev => ({ ...prev, urgency: e.target.value }))}
                      className="input"
                    >
                      <option value="basse">Basse</option>
                      <option value="moyenne">Moyenne</option>
                      <option value="haute">Haute</option>
                      <option value="critique">Critique</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Action</label>
                    <select
                      value={validationData.action}
                      onChange={(e) => setValidationData(prev => ({ ...prev, action: e.target.value }))}
                      className="input"
                    >
                      <option value="take_charge">Prendre en charge</option>
                      <option value="escalate">Escalader au niveau supérieur</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowValidation(false)}
                      className="btn btn-secondary"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleValidate}
                      disabled={isSubmitting}
                      className="btn btn-primary"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions de statut */}
          {canChangeStatus && ticket.status !== 'cloture' && ticket.status !== 'annule' && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
              <div className="flex flex-wrap gap-2">
                {ticket.status === 'valide' && (
                  <button
                    onClick={() => handleStatusChange('en_cours')}
                    className="btn btn-primary"
                  >
                    Démarrer le traitement
                  </button>
                )}
                {ticket.status === 'en_cours' && (
                  <button
                    onClick={() => handleStatusChange('resolu')}
                    className="btn btn-success"
                  >
                    Marquer comme résolu
                  </button>
                )}
                {ticket.status === 'resolu' && (
                  <button
                    onClick={() => handleStatusChange('cloture')}
                    className="btn btn-secondary"
                  >
                    Clôturer
                  </button>
                )}
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
                      comment.is_confidential ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-700">
                            {comment.author_first_name?.[0]}{comment.author_last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {comment.author_first_name} {comment.author_last_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(comment.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {comment.is_confidential && (
                        <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                          <Lock className="w-3 h-3" />
                          Confidentiel
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

        {/* Colonne latérale */}
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
                  <dt className="text-sm text-gray-500">Créé par</dt>
                  <dd className="font-medium">
                    {ticket.creator_first_name} {ticket.creator_last_name}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-sm text-gray-500">Créé le</dt>
                  <dd className="font-medium">
                    {format(new Date(ticket.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </dd>
                </div>
              </div>
              {ticket.assigned_to_id && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <dt className="text-sm text-gray-500">Assigné à</dt>
                    <dd className="font-medium">
                      {ticket.assigned_first_name} {ticket.assigned_last_name}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          {/* SLA */}
          {ticket.response_deadline && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">SLA</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Réponse</p>
                  <p className={clsx(
                    'font-medium',
                    new Date(ticket.response_deadline) < new Date() ? 'text-red-600' : 'text-green-600'
                  )}>
                    {format(new Date(ticket.response_deadline), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Résolution</p>
                  <p className={clsx(
                    'font-medium',
                    new Date(ticket.resolution_deadline) < new Date() ? 'text-red-600' : 'text-green-600'
                  )}>
                    {format(new Date(ticket.resolution_deadline), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Visibilité syndicat */}
          {canToggleUnion && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Visibilité syndicat</h3>
              <button
                onClick={handleToggleUnion}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors',
                  ticket.visible_to_union
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {ticket.visible_to_union ? (
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
    </div>
  );
}

export default TicketDetailPage;
