const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// Toutes les routes nécessitent l'authentification
router.use(authenticate);

// GET /api/notifications - Récupérer les notifications de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const { unread_only, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT n.*,
             t.reference as ticket_reference,
             t.title as ticket_title,
             a.name as agency_name
      FROM notifications n
      LEFT JOIN tickets t ON n.ticket_id = t.id
      LEFT JOIN agencies a ON n.agency_id = a.id
      WHERE n.user_id = $1
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (unread_only === 'true') {
      sql += ` AND n.is_read = false`;
    }

    sql += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);

    // Compter les non-lues
    const { rows: countRows } = await query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({
      notifications: rows,
      unread_count: parseInt(countRows[0].unread_count),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('Erreur récupération notifications:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
  }
});

// GET /api/notifications/count - Compter les notifications non-lues
router.get('/count', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json({ unread_count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('Erreur comptage notifications:', err);
    res.status(500).json({ error: 'Erreur lors du comptage des notifications' });
  }
});

// PUT /api/notifications/:id/read - Marquer une notification comme lue
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `UPDATE notifications
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur marquage notification:', err);
    res.status(500).json({ error: 'Erreur lors du marquage de la notification' });
  }
});

// PUT /api/notifications/read-all - Marquer toutes les notifications comme lues
router.put('/read-all', async (req, res) => {
  try {
    const { agency_id } = req.body;

    let sql = `
      UPDATE notifications
      SET is_read = true, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_read = false
    `;
    const params = [req.user.id];

    if (agency_id) {
      sql += ' AND agency_id = $2';
      params.push(agency_id);
    }

    const result = await query(sql, params);

    res.json({
      message: 'Notifications marquées comme lues',
      count: result.rowCount
    });
  } catch (err) {
    console.error('Erreur marquage notifications:', err);
    res.status(500).json({ error: 'Erreur lors du marquage des notifications' });
  }
});

// DELETE /api/notifications/:id - Supprimer une notification
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json({ message: 'Notification supprimée' });
  } catch (err) {
    console.error('Erreur suppression notification:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// DELETE /api/notifications - Supprimer toutes les notifications lues
router.delete('/', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [req.user.id]
    );

    res.json({
      message: 'Notifications supprimées',
      count: result.rowCount
    });
  } catch (err) {
    console.error('Erreur suppression notifications:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// GET /api/notifications/preferences - Récupérer les préférences de notification
router.get('/preferences', async (req, res) => {
  try {
    // Les préférences sont stockées dans le champ notification_preferences de l'utilisateur
    const { rows } = await query(
      'SELECT notification_preferences FROM users WHERE id = $1',
      [req.user.id]
    );

    const defaultPreferences = {
      email_new_ticket: true,
      email_ticket_assigned: true,
      email_ticket_updated: true,
      email_ticket_escalated: true,
      email_ticket_resolved: true,
      email_comment_added: true,
      email_sla_warning: true,
      email_sla_breach: true,
      push_enabled: true,
      digest_daily: false,
      digest_weekly: false
    };

    const preferences = rows[0]?.notification_preferences || defaultPreferences;

    res.json({ preferences: { ...defaultPreferences, ...preferences } });
  } catch (err) {
    console.error('Erreur récupération préférences:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des préférences' });
  }
});

// PUT /api/notifications/preferences - Mettre à jour les préférences
router.put('/preferences', async (req, res) => {
  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Préférences invalides' });
    }

    const { rows } = await query(
      `UPDATE users
       SET notification_preferences = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING notification_preferences`,
      [JSON.stringify(preferences), req.user.id]
    );

    res.json({
      message: 'Préférences mises à jour',
      preferences: rows[0].notification_preferences
    });
  } catch (err) {
    console.error('Erreur mise à jour préférences:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des préférences' });
  }
});

// Fonction utilitaire pour créer une notification (exportée pour utilisation dans d'autres routes)
const createNotification = async (userId, agencyId, ticketId, type, title, message) => {
  try {
    const { rows } = await query(
      `INSERT INTO notifications (user_id, agency_id, ticket_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, agencyId, ticketId, type, title, message]
    );
    return rows[0];
  } catch (err) {
    console.error('Erreur création notification:', err);
    return null;
  }
};

// Fonction pour envoyer des notifications à plusieurs utilisateurs
const notifyUsers = async (userIds, agencyId, ticketId, type, title, message) => {
  try {
    const notifications = [];
    for (const userId of userIds) {
      const notif = await createNotification(userId, agencyId, ticketId, type, title, message);
      if (notif) notifications.push(notif);
    }
    return notifications;
  } catch (err) {
    console.error('Erreur envoi notifications multiples:', err);
    return [];
  }
};

// Fonction pour notifier les utilisateurs d'un niveau hiérarchique
const notifyLevel = async (agencyId, levelNumber, ticketId, type, title, message) => {
  try {
    const { rows: users } = await query(
      `SELECT DISTINCT u.id
       FROM users u
       JOIN user_agency_access uaa ON u.id = uaa.user_id
       JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
       WHERE uaa.agency_id = $1 AND hl.level_number = $2 AND uaa.is_active = true AND u.is_active = true`,
      [agencyId, levelNumber]
    );

    const userIds = users.map(u => u.id);
    return await notifyUsers(userIds, agencyId, ticketId, type, title, message);
  } catch (err) {
    console.error('Erreur notification niveau:', err);
    return [];
  }
};

module.exports = router;
module.exports.createNotification = createNotification;
module.exports.notifyUsers = notifyUsers;
module.exports.notifyLevel = notifyLevel;
