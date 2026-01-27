const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

let io = null;
const userSockets = new Map(); // userId -> Set of socket ids
const socketUsers = new Map(); // socketId -> userId

/**
 * Initialise le serveur WebSocket
 */
function initWebSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Middleware d'authentification
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Token requis'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Vérifier que l'utilisateur existe et est actif
      const { rows } = await query(
        'SELECT id, email, first_name, last_name, account_type FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (rows.length === 0) {
        return next(new Error('Utilisateur non trouvé'));
      }

      socket.user = rows[0];
      next();
    } catch (err) {
      console.error('Erreur auth WebSocket:', err.message);
      next(new Error('Token invalide'));
    }
  });

  // Gestion des connexions
  io.on('connection', (socket) => {
    const userId = socket.user.id;

    console.log(`🔌 WebSocket connecté: ${socket.user.email} (${socket.id})`);

    // Enregistrer le socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketUsers.set(socket.id, userId);

    // Rejoindre les rooms de l'utilisateur
    socket.join(`user:${userId}`);

    // Charger et rejoindre les rooms des agences
    loadUserAgencies(userId).then(agencies => {
      agencies.forEach(agencyId => {
        socket.join(`agency:${agencyId}`);
      });
    });

    // Envoyer le compteur de notifications non lues
    sendUnreadCount(userId);

    // Écouter les événements du client
    socket.on('join_ticket', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`${socket.user.email} a rejoint ticket:${ticketId}`);
    });

    socket.on('leave_ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    socket.on('mark_notification_read', async (notificationId) => {
      try {
        await query(
          'UPDATE notifications SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
          [notificationId, userId]
        );
        sendUnreadCount(userId);
      } catch (err) {
        console.error('Erreur marquage notification:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket déconnecté: ${socket.user.email}`);

      // Nettoyer les maps
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
      socketUsers.delete(socket.id);
    });
  });

  console.log('✅ WebSocket initialisé');
  return io;
}

/**
 * Charger les agences d'un utilisateur
 */
async function loadUserAgencies(userId) {
  try {
    const { rows } = await query(
      'SELECT agency_id FROM user_agency_access WHERE user_id = $1 AND is_active = true',
      [userId]
    );
    return rows.map(r => r.agency_id);
  } catch (err) {
    console.error('Erreur chargement agences:', err);
    return [];
  }
}

/**
 * Envoyer le compteur de notifications non lues
 */
async function sendUnreadCount(userId) {
  try {
    const { rows } = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    emitToUser(userId, 'unread_count', { count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('Erreur envoi compteur:', err);
  }
}

/**
 * Émettre un événement à un utilisateur spécifique
 */
function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Émettre un événement à tous les utilisateurs d'une agence
 */
function emitToAgency(agencyId, event, data) {
  if (!io) return;
  io.to(`agency:${agencyId}`).emit(event, data);
}

/**
 * Émettre un événement à tous ceux qui regardent un ticket
 */
function emitToTicket(ticketId, event, data) {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, data);
}

/**
 * Créer et envoyer une notification temps réel
 */
async function createAndSendNotification(userId, type, title, message, ticketId = null, data = {}) {
  try {
    // Insérer en base
    const { rows } = await query(
      `INSERT INTO notifications (user_id, ticket_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, ticketId, type, title, message]
    );

    const notification = rows[0];

    // Enrichir avec les infos du ticket si présent
    if (ticketId) {
      const { rows: ticketRows } = await query(
        `SELECT ticket_number,
                (SELECT code FROM agencies WHERE id = tickets.agency_id) || '-' || ticket_number as reference,
                title
         FROM tickets WHERE id = $1`,
        [ticketId]
      );
      if (ticketRows.length > 0) {
        notification.ticket_reference = ticketRows[0].reference;
        notification.ticket_title = ticketRows[0].title;
      }
    }

    // Envoyer en temps réel
    emitToUser(userId, 'notification', {
      ...notification,
      ...data
    });

    // Mettre à jour le compteur
    sendUnreadCount(userId);

    return notification;
  } catch (err) {
    console.error('Erreur création notification:', err);
    return null;
  }
}

/**
 * Notifier la création d'un ticket
 */
async function notifyTicketCreated(ticket, creatorName) {
  // Trouver les utilisateurs du niveau supérieur qui doivent valider
  const { rows: validators } = await query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_agency_access uaa ON u.id = uaa.user_id
     JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
     WHERE uaa.agency_id = $1
     AND hl.level_number = $2
     AND uaa.is_active = true
     AND u.is_active = true`,
    [ticket.agency_id, ticket.created_at_level + 1]
  );

  for (const validator of validators) {
    await createAndSendNotification(
      validator.id,
      'ticket_created',
      'Nouveau ticket à valider',
      `${creatorName} a créé un nouveau ticket: ${ticket.title}`,
      ticket.id
    );
  }

  // Émettre sur le canal de l'agence
  emitToAgency(ticket.agency_id, 'ticket_created', {
    ticket_id: ticket.id,
    title: ticket.title,
    urgency: ticket.proposed_urgency
  });
}

/**
 * Notifier l'assignation d'un ticket
 */
async function notifyTicketAssigned(ticket, assignedToId, assignedByName) {
  await createAndSendNotification(
    assignedToId,
    'ticket_assigned',
    'Ticket assigné',
    `${assignedByName} vous a assigné le ticket: ${ticket.title}`,
    ticket.id
  );
}

/**
 * Notifier le changement de statut
 */
async function notifyStatusChange(ticket, newStatus, changedByName) {
  // Notifier le créateur
  if (ticket.created_by !== ticket.current_responsible) {
    await createAndSendNotification(
      ticket.created_by,
      'ticket_updated',
      'Ticket mis à jour',
      `Le statut de votre ticket est passé à "${newStatus}"`,
      ticket.id
    );
  }

  // Émettre sur le canal du ticket
  emitToTicket(ticket.id, 'ticket_updated', {
    ticket_id: ticket.id,
    field: 'status',
    value: newStatus,
    changed_by: changedByName
  });
}

/**
 * Notifier un nouveau commentaire
 */
async function notifyNewComment(ticketId, comment, authorName, recipientIds) {
  for (const recipientId of recipientIds) {
    if (recipientId !== comment.user_id) {
      await createAndSendNotification(
        recipientId,
        'comment_added',
        'Nouveau commentaire',
        `${authorName} a ajouté un commentaire`,
        ticketId
      );
    }
  }

  // Émettre sur le canal du ticket
  emitToTicket(ticketId, 'new_comment', {
    ticket_id: ticketId,
    comment_id: comment.id,
    author: authorName,
    preview: comment.content.substring(0, 100)
  });
}

/**
 * Notifier une escalade
 */
async function notifyEscalation(ticket, fromLevel, toLevel, escalatedByName) {
  // Trouver les utilisateurs du niveau cible
  const { rows: targetUsers } = await query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_agency_access uaa ON u.id = uaa.user_id
     JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
     WHERE uaa.agency_id = $1
     AND hl.level_number = $2
     AND uaa.is_active = true
     AND u.is_active = true`,
    [ticket.agency_id, toLevel]
  );

  for (const user of targetUsers) {
    await createAndSendNotification(
      user.id,
      'ticket_escalated',
      'Ticket escaladé',
      `Un ticket a été escaladé du niveau ${fromLevel} au niveau ${toLevel}`,
      ticket.id
    );
  }
}

/**
 * Notifier un avertissement SLA
 */
async function notifySLAWarning(ticket, slaType, deadline) {
  const title = slaType === 'response' ? 'SLA Réponse en danger' : 'SLA Résolution en danger';

  // Notifier le responsable actuel
  if (ticket.current_responsible) {
    await createAndSendNotification(
      ticket.current_responsible,
      'sla_warning',
      title,
      `Le ${slaType === 'response' ? 'temps de réponse' : 'temps de résolution'} approche de sa limite`,
      ticket.id
    );
  }

  // Notifier les niveaux supérieurs
  const { rows: superiors } = await query(
    `SELECT DISTINCT u.id
     FROM users u
     JOIN user_agency_access uaa ON u.id = uaa.user_id
     JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
     WHERE uaa.agency_id = $1
     AND hl.level_number > $2
     AND uaa.is_active = true
     AND u.is_active = true`,
    [ticket.agency_id, ticket.current_level]
  );

  for (const superior of superiors) {
    await createAndSendNotification(
      superior.id,
      'sla_warning',
      title,
      `Un ticket approche de sa limite SLA`,
      ticket.id
    );
  }
}

/**
 * Vérifier si un utilisateur est connecté
 */
function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Obtenir le nombre de connexions actives
 */
function getActiveConnections() {
  return socketUsers.size;
}

module.exports = {
  initWebSocket,
  emitToUser,
  emitToAgency,
  emitToTicket,
  createAndSendNotification,
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChange,
  notifyNewComment,
  notifyEscalation,
  notifySLAWarning,
  isUserOnline,
  getActiveConnections
};
