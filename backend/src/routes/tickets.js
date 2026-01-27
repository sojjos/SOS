const express = require('express');
const { body, query: queryValidator, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAgencyAccess, requirePermission } = require('../middlewares/auth');

const router = express.Router();

// ====================================
// GET /api/tickets - Liste des tickets
// ====================================
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      agency_id,
      status,
      urgency,
      blocking,
      location_id,
      problem_type_id,
      created_by,
      responsible,
      my_tickets,
      pending_validation,
      page = 1,
      limit = 25,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = req.query;

    const user = req.user;
    const offset = (page - 1) * limit;

    // Construction de la requête
    let baseQuery = `
      SELECT t.*,
             a.name as agency_name,
             pt.name as problem_type_name,
             l.name as location_name,
             uc.first_name || ' ' || uc.last_name as created_by_name,
             ur.first_name || ' ' || ur.last_name as responsible_name,
             CASE
               WHEN t.sla_resolution_deadline IS NOT NULL
                    AND t.status NOT IN ('resolu', 'cloture')
                    AND t.sla_resolution_deadline < CURRENT_TIMESTAMP
               THEN true ELSE false
             END as is_sla_exceeded
      FROM tickets t
      LEFT JOIN agencies a ON t.agency_id = a.id
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      LEFT JOIN locations l ON t.primary_location_id = l.id
      LEFT JOIN users uc ON t.created_by = uc.id
      LEFT JOIN users ur ON t.current_responsible = ur.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filtrer par agence selon les accès
    if (user.account_type === 'admin' || user.account_type === 'admin_delegated') {
      if (agency_id) {
        baseQuery += ` AND t.agency_id = $${paramIndex++}`;
        params.push(agency_id);
      }
    } else {
      // Utilisateur standard: filtrer par ses agences accessibles
      const accessibleAgencies = user.agency_accesses?.map(a => a.agency_id) || [];
      if (accessibleAgencies.length === 0) {
        return res.json({ tickets: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      }

      if (agency_id && accessibleAgencies.includes(agency_id)) {
        baseQuery += ` AND t.agency_id = $${paramIndex++}`;
        params.push(agency_id);
      } else {
        baseQuery += ` AND t.agency_id = ANY($${paramIndex++})`;
        params.push(accessibleAgencies);
      }

      // Filtrer selon le niveau hiérarchique
      const userAccess = agency_id
        ? user.agency_accesses?.find(a => a.agency_id === agency_id)
        : user.agency_accesses?.[0];

      if (userAccess) {
        const permissions = userAccess.permissions || {};
        if (!permissions.can_see_all_site_tickets && !permissions.can_see_team_tickets) {
          // Ne voit que ses propres tickets
          baseQuery += ` AND t.created_by = $${paramIndex++}`;
          params.push(user.id);
        } else if (permissions.can_see_team_tickets && !permissions.can_see_all_site_tickets) {
          // Voit les tickets de son niveau et en dessous
          baseQuery += ` AND (t.created_by = $${paramIndex++} OR t.current_level <= $${paramIndex++})`;
          params.push(user.id, userAccess.level_number);
        }
      }
    }

    // Autres filtres
    if (status) {
      baseQuery += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    if (urgency) {
      baseQuery += ` AND t.validated_urgency = $${paramIndex++}`;
      params.push(urgency);
    }

    if (blocking) {
      baseQuery += ` AND t.validated_blocking = $${paramIndex++}`;
      params.push(blocking);
    }

    if (location_id) {
      baseQuery += ` AND t.primary_location_id = $${paramIndex++}`;
      params.push(location_id);
    }

    if (problem_type_id) {
      baseQuery += ` AND t.problem_type_id = $${paramIndex++}`;
      params.push(problem_type_id);
    }

    if (created_by) {
      baseQuery += ` AND t.created_by = $${paramIndex++}`;
      params.push(created_by);
    }

    if (responsible) {
      baseQuery += ` AND t.current_responsible = $${paramIndex++}`;
      params.push(responsible);
    }

    if (my_tickets === 'true') {
      baseQuery += ` AND (t.created_by = $${paramIndex++} OR t.current_responsible = $${paramIndex++})`;
      params.push(user.id, user.id);
    }

    if (pending_validation === 'true') {
      baseQuery += ` AND t.status = 'en_attente_validation' AND t.current_responsible = $${paramIndex++}`;
      params.push(user.id);
    }

    // Comptage total
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as subquery`;
    const { rows: countRows } = await query(countQuery, params);
    const total = parseInt(countRows[0].total);

    // Tri et pagination
    const allowedSortFields = ['created_at', 'updated_at', 'validated_urgency', 'status', 'ticket_number'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    baseQuery += ` ORDER BY t.${sortField} ${sortDir} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), offset);

    const { rows: tickets } = await query(baseQuery, params);

    res.json({
      tickets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Erreur liste tickets:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des tickets' });
  }
});

// ====================================
// GET /api/tickets/:id - Détail d'un ticket
// ====================================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le ticket
    const { rows } = await query(`
      SELECT t.*,
             a.name as agency_name,
             pt.name as problem_type_name, pt.color as problem_type_color,
             l.name as location_name, l.location_type,
             uc.first_name || ' ' || uc.last_name as created_by_name, uc.email as created_by_email,
             ur.first_name || ' ' || ur.last_name as responsible_name,
             uv.first_name || ' ' || uv.last_name as validated_by_name,
             ures.first_name || ' ' || ures.last_name as resolved_by_name
      FROM tickets t
      LEFT JOIN agencies a ON t.agency_id = a.id
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      LEFT JOIN locations l ON t.primary_location_id = l.id
      LEFT JOIN users uc ON t.created_by = uc.id
      LEFT JOIN users ur ON t.current_responsible = ur.id
      LEFT JOIN users uv ON t.validated_by = uv.id
      LEFT JOIN users ures ON t.resolved_by = ures.id
      WHERE t.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    const ticket = rows[0];

    // Vérifier l'accès
    const user = req.user;
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const hasAccess = user.agency_accesses?.some(a => a.agency_id === ticket.agency_id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Accès non autorisé à ce ticket' });
      }
    }

    // Récupérer les commentaires (filtrer selon les permissions)
    let commentsQuery = `
      SELECT c.*,
             u.first_name || ' ' || u.last_name as user_name,
             cg.name as confidentiality_group_name
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN confidentiality_groups cg ON c.confidentiality_group_id = cg.id
      WHERE c.ticket_id = $1
    `;

    // Filtrer les commentaires confidentiels selon le niveau
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const userAccess = user.agency_accesses?.find(a => a.agency_id === ticket.agency_id);
      const userLevel = userAccess?.level_number || 0;

      commentsQuery += `
        AND (c.is_public = true
             OR c.confidentiality_group_id IS NULL
             OR EXISTS (
               SELECT 1 FROM confidentiality_groups cg2
               WHERE cg2.id = c.confidentiality_group_id
               AND $2 = ANY(ARRAY(SELECT jsonb_array_elements_text(cg2.can_read_levels)::int))
             ))
      `;
      const { rows: comments } = await query(commentsQuery + ' ORDER BY c.created_at ASC', [id, userLevel]);
      ticket.comments = comments;
    } else {
      const { rows: comments } = await query(commentsQuery + ' ORDER BY c.created_at ASC', [id]);
      ticket.comments = comments;
    }

    // Récupérer l'historique
    const { rows: history } = await query(`
      SELECT th.*,
             u.first_name || ' ' || u.last_name as user_name
      FROM ticket_history th
      LEFT JOIN users u ON th.user_id = u.id
      WHERE th.ticket_id = $1
      ORDER BY th.created_at DESC
      LIMIT 50
    `, [id]);
    ticket.history = history;

    // Récupérer les escalades
    const { rows: escalations } = await query(`
      SELECT te.*,
             uf.first_name || ' ' || uf.last_name as from_user_name,
             ut.first_name || ' ' || ut.last_name as to_user_name
      FROM ticket_escalations te
      LEFT JOIN users uf ON te.from_user_id = uf.id
      LEFT JOIN users ut ON te.to_user_id = ut.id
      WHERE te.ticket_id = $1
      ORDER BY te.created_at DESC
    `, [id]);
    ticket.escalations = escalations;

    res.json(ticket);
  } catch (err) {
    console.error('Erreur détail ticket:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du ticket' });
  }
});

// ====================================
// POST /api/tickets - Créer un ticket
// ====================================
router.post('/', authenticate, [
  body('agency_id').isUUID().withMessage('ID agence invalide'),
  body('title').trim().notEmpty().withMessage('Titre requis'),
  body('description').trim().notEmpty().withMessage('Description requise'),
  body('proposed_urgency').isIn(['critique', 'haute', 'moyenne', 'basse']).withMessage('Urgence invalide'),
  body('proposed_blocking').isIn(['bloquant', 'partiel', 'non_bloquant']).withMessage('Niveau de blocage invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = req.user;
    const {
      agency_id,
      title,
      description,
      problem_type_id,
      recurrence,
      recurrence_details,
      primary_location_id,
      location_details,
      impacted_locations,
      proposed_urgency,
      proposed_blocking,
      impact_description,
      affected_processes,
      workaround,
      has_workaround
    } = req.body;

    // Vérifier l'accès à l'agence
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const hasAccess = user.agency_accesses?.some(a => a.agency_id === agency_id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Accès non autorisé à cette agence' });
      }
    }

    // Récupérer le niveau de l'utilisateur
    let userLevel = 0;
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const userAccess = user.agency_accesses?.find(a => a.agency_id === agency_id);
      userLevel = userAccess?.level_number || 0;
    } else {
      userLevel = 999;
    }

    // Vérifier le niveau requis pour le type de problème
    if (problem_type_id) {
      const { rows: typeRows } = await query(
        'SELECT min_level_required FROM problem_types WHERE id = $1 AND agency_id = $2',
        [problem_type_id, agency_id]
      );

      if (typeRows.length === 0) {
        return res.status(400).json({ error: 'Type de problème invalide ou non autorisé pour cette agence' });
      }

      const minLevelRequired = typeRows[0].min_level_required || 0;
      if (userLevel < minLevelRequired) {
        return res.status(403).json({
          error: `Votre niveau (${userLevel}) ne permet pas de créer ce type de ticket. Niveau minimum requis: ${minLevelRequired}`
        });
      }
    }

    // Créer le ticket
    const { rows } = await query(`
      INSERT INTO tickets (
        agency_id, title, description, problem_type_id,
        recurrence, recurrence_details,
        primary_location_id, location_details, impacted_locations,
        proposed_urgency, proposed_blocking,
        impact_description, affected_processes, workaround, has_workaround,
        created_by, created_at_level, current_level, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, 'en_attente_validation'
      ) RETURNING *
    `, [
      agency_id,
      title,
      description,
      problem_type_id || null,
      recurrence || 'ponctuel',
      recurrence_details ? JSON.stringify(recurrence_details) : null,
      primary_location_id || null,
      location_details || null,
      impacted_locations ? JSON.stringify(impacted_locations) : '[]',
      proposed_urgency,
      proposed_blocking,
      impact_description || null,
      affected_processes ? JSON.stringify(affected_processes) : '[]',
      workaround || null,
      has_workaround || false,
      user.id,
      userLevel
    ]);

    const ticket = rows[0];

    // Ajouter à l'historique
    await query(`
      INSERT INTO ticket_history (ticket_id, user_id, action, details)
      VALUES ($1, $2, 'created', $3)
    `, [
      ticket.id,
      user.id,
      JSON.stringify({ title, proposed_urgency, proposed_blocking })
    ]);

    // Trouver le responsable au niveau supérieur pour validation
    // TODO: Implémenter la logique de notification

    res.status(201).json(ticket);
  } catch (err) {
    console.error('Erreur création ticket:', err);
    res.status(500).json({ error: 'Erreur lors de la création du ticket' });
  }
});

// ====================================
// PUT /api/tickets/:id/validate - Valider un ticket
// ====================================
router.put('/:id/validate', authenticate, [
  body('validated_urgency').isIn(['critique', 'haute', 'moyenne', 'basse']).withMessage('Urgence invalide'),
  body('validated_blocking').isIn(['bloquant', 'partiel', 'non_bloquant']).withMessage('Blocage invalide'),
  body('action').isIn(['take_charge', 'escalate', 'return']).withMessage('Action invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = req.user;
    const {
      validated_urgency,
      validated_blocking,
      urgency_justification,
      action,
      escalation_reason,
      return_reason
    } = req.body;

    // Récupérer le ticket
    const { rows } = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    const ticket = rows[0];

    // Vérifier les permissions
    // TODO: Vérifier que l'utilisateur est bien le niveau supérieur du créateur

    let newStatus;
    let newResponsible = null;

    if (action === 'take_charge') {
      newStatus = 'en_cours';
      newResponsible = user.id;
    } else if (action === 'escalate') {
      newStatus = 'en_attente_validation';
      // TODO: Trouver le niveau supérieur
    } else if (action === 'return') {
      newStatus = 'nouveau';
      newResponsible = ticket.created_by;
    }

    // Mettre à jour le ticket
    await query(`
      UPDATE tickets SET
        validated_urgency = $1,
        validated_blocking = $2,
        urgency_justification = $3,
        validated_by = $4,
        validated_at = CURRENT_TIMESTAMP,
        status = $5,
        current_responsible = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
    `, [
      validated_urgency,
      validated_blocking,
      urgency_justification || null,
      user.id,
      newStatus,
      newResponsible,
      id
    ]);

    // Ajouter à l'historique
    await query(`
      INSERT INTO ticket_history (ticket_id, user_id, action, details)
      VALUES ($1, $2, 'validated', $3)
    `, [
      id,
      user.id,
      JSON.stringify({
        validated_urgency,
        validated_blocking,
        action,
        urgency_justification
      })
    ]);

    // Si escalade, créer l'enregistrement
    if (action === 'escalate') {
      await query(`
        INSERT INTO ticket_escalations (ticket_id, from_user_id, from_level, to_level, reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        id,
        user.id,
        ticket.current_level,
        ticket.current_level + 1,
        escalation_reason
      ]);
    }

    // Récupérer le ticket mis à jour
    const { rows: updatedRows } = await query('SELECT * FROM tickets WHERE id = $1', [id]);

    res.json(updatedRows[0]);
  } catch (err) {
    console.error('Erreur validation ticket:', err);
    res.status(500).json({ error: 'Erreur lors de la validation du ticket' });
  }
});

// ====================================
// PUT /api/tickets/:id/status - Changer le statut
// ====================================
router.put('/:id/status', authenticate, [
  body('status').isIn(['en_analyse', 'en_cours', 'resolu', 'cloture']).withMessage('Statut invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = req.user;
    const { status, resolution_type, resolution_description } = req.body;

    // Récupérer le ticket
    const { rows } = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    const ticket = rows[0];
    const oldStatus = ticket.status;

    // Mise à jour
    let updateQuery = `
      UPDATE tickets SET
        status = $1,
        updated_at = CURRENT_TIMESTAMP
    `;
    const params = [status];
    let paramIndex = 2;

    if (status === 'resolu') {
      updateQuery += `, resolved_by = $${paramIndex++}, resolved_at = CURRENT_TIMESTAMP`;
      params.push(user.id);

      if (resolution_type) {
        updateQuery += `, resolution_type = $${paramIndex++}`;
        params.push(resolution_type);
      }
      if (resolution_description) {
        updateQuery += `, resolution_description = $${paramIndex++}`;
        params.push(resolution_description);
      }
    }

    if (status === 'cloture') {
      updateQuery += `, closed_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $${paramIndex}`;
    params.push(id);

    await query(updateQuery, params);

    // Historique
    await query(`
      INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
      VALUES ($1, $2, 'status_changed', 'status', $3, $4)
    `, [id, user.id, oldStatus, status]);

    const { rows: updatedRows } = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    res.json(updatedRows[0]);
  } catch (err) {
    console.error('Erreur changement statut:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut' });
  }
});

// ====================================
// POST /api/tickets/:id/comments - Ajouter un commentaire
// ====================================
router.post('/:id/comments', authenticate, [
  body('content').trim().notEmpty().withMessage('Contenu requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const user = req.user;
    const { content, is_public = true, confidentiality_group_id } = req.body;

    // Vérifier que le ticket existe
    const { rows: ticketRows } = await query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    // Créer le commentaire
    const { rows } = await query(`
      INSERT INTO comments (ticket_id, user_id, content, is_public, confidentiality_group_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      id,
      user.id,
      content,
      is_public,
      confidentiality_group_id || null
    ]);

    const comment = rows[0];

    // Ajouter info utilisateur
    comment.user_name = `${user.first_name} ${user.last_name}`;

    // Historique
    await query(`
      INSERT INTO ticket_history (ticket_id, user_id, action, details)
      VALUES ($1, $2, 'comment_added', $3)
    `, [
      id,
      user.id,
      JSON.stringify({ is_public, has_confidentiality: !!confidentiality_group_id })
    ]);

    res.status(201).json(comment);
  } catch (err) {
    console.error('Erreur ajout commentaire:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout du commentaire' });
  }
});

// ====================================
// PUT /api/tickets/:id/visibility - Changer visibilité syndicat
// ====================================
router.put('/:id/visibility', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_visible_union } = req.body;
    const user = req.user;

    await query(`
      UPDATE tickets SET
        is_visible_union = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [is_visible_union, id]);

    // Historique
    await query(`
      INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
      VALUES ($1, $2, 'visibility_changed', 'is_visible_union', NULL, $3)
    `, [id, user.id, is_visible_union.toString()]);

    res.json({ message: 'Visibilité mise à jour' });
  } catch (err) {
    console.error('Erreur changement visibilité:', err);
    res.status(500).json({ error: 'Erreur lors du changement de visibilité' });
  }
});

// ====================================
// GET /api/tickets/:id/history - Historique d'un ticket
// ====================================
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier l'accès au ticket
    const { rows: ticketRows } = await query(
      'SELECT agency_id FROM tickets WHERE id = $1',
      [id]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    // Récupérer l'historique avec les noms des utilisateurs
    const { rows } = await query(`
      SELECT
        th.id,
        th.action,
        th.field_name,
        th.old_value,
        th.new_value,
        th.details,
        th.created_at,
        u.first_name || ' ' || u.last_name as user_name
      FROM ticket_history th
      JOIN users u ON th.user_id = u.id
      WHERE th.ticket_id = $1
      ORDER BY th.created_at ASC
    `, [id]);

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération historique:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
});

module.exports = router;
