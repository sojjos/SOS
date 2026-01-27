const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middlewares/auth');

router.use(authenticate);

// GET /api/dynamic-questions/agency/:agencyId - Récupérer toutes les questions d'une agence
router.get('/agency/:agencyId', async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { problem_type_id, urgency, blocking_level } = req.query;

    let sql = `
      SELECT dq.*, pt.name as problem_type_name
      FROM dynamic_questions dq
      LEFT JOIN problem_types pt ON dq.problem_type_id = pt.id
      WHERE dq.agency_id = $1 AND dq.is_active = true
    `;
    const params = [agencyId];
    let paramIndex = 2;

    // Filtrer par type de problème
    if (problem_type_id) {
      sql += ` AND (dq.problem_type_id = $${paramIndex} OR dq.problem_type_id IS NULL)`;
      params.push(problem_type_id);
      paramIndex++;
    }

    // Filtrer par urgence
    if (urgency) {
      sql += ` AND (dq.urgency_trigger @> ARRAY[$${paramIndex}]::varchar[] OR dq.urgency_trigger = '{}')`;
      params.push(urgency);
      paramIndex++;
    }

    // Filtrer par niveau de blocage
    if (blocking_level) {
      sql += ` AND (dq.blocking_trigger @> ARRAY[$${paramIndex}]::varchar[] OR dq.blocking_trigger = '{}')`;
      params.push(blocking_level);
      paramIndex++;
    }

    sql += ' ORDER BY dq.display_order, dq.created_at';

    const { rows } = await query(sql, params);

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération questions:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/dynamic-questions/ticket/:ticketId - Questions applicables à un ticket
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Récupérer les infos du ticket
    const { rows: ticketRows } = await query(
      `SELECT agency_id, problem_type_id, proposed_urgency, validated_urgency,
              proposed_blocking, validated_blocking
       FROM tickets WHERE id = $1`,
      [ticketId]
    );

    if (ticketRows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    const ticket = ticketRows[0];
    const urgency = ticket.validated_urgency || ticket.proposed_urgency;
    const blocking = ticket.validated_blocking || ticket.proposed_blocking;

    // Récupérer les questions applicables
    const { rows: questions } = await query(
      `SELECT dq.*
       FROM dynamic_questions dq
       WHERE dq.agency_id = $1
       AND dq.is_active = true
       AND (dq.problem_type_id = $2 OR dq.problem_type_id IS NULL)
       AND (dq.urgency_trigger @> ARRAY[$3]::varchar[] OR dq.urgency_trigger = '{}' OR dq.urgency_trigger IS NULL)
       AND (dq.blocking_trigger @> ARRAY[$4]::varchar[] OR dq.blocking_trigger = '{}' OR dq.blocking_trigger IS NULL)
       ORDER BY dq.display_order, dq.created_at`,
      [ticket.agency_id, ticket.problem_type_id, urgency || 'moyenne', blocking || 'non_bloquant']
    );

    // Récupérer les réponses existantes
    const { rows: responses } = await query(
      `SELECT question_id, response_value
       FROM dynamic_question_responses
       WHERE ticket_id = $1`,
      [ticketId]
    );

    const responsesMap = responses.reduce((acc, r) => {
      acc[r.question_id] = r.response_value;
      return acc;
    }, {});

    // Combiner questions et réponses
    const questionsWithResponses = questions.map(q => ({
      ...q,
      response: responsesMap[q.id] || null
    }));

    res.json(questionsWithResponses);
  } catch (err) {
    console.error('Erreur récupération questions ticket:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/dynamic-questions/ticket/:ticketId/responses - Sauvegarder les réponses
router.post('/ticket/:ticketId/responses', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Réponses invalides' });
    }

    // Vérifier l'accès au ticket
    const { rows: ticket } = await query(
      'SELECT agency_id, created_by FROM tickets WHERE id = $1',
      [ticketId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    // Sauvegarder chaque réponse
    for (const response of responses) {
      if (!response.question_id || response.value === undefined) continue;

      // Vérifier que la question existe
      const { rows: question } = await query(
        'SELECT id, is_required, validation_rules FROM dynamic_questions WHERE id = $1',
        [response.question_id]
      );

      if (question.length === 0) continue;

      // Valider si requis
      if (question[0].is_required && (response.value === null || response.value === '')) {
        return res.status(400).json({
          error: 'Réponse requise',
          question_id: response.question_id
        });
      }

      // Upsert la réponse
      await query(
        `INSERT INTO dynamic_question_responses (ticket_id, question_id, response_value)
         VALUES ($1, $2, $3)
         ON CONFLICT (ticket_id, question_id)
         DO UPDATE SET response_value = $3, updated_at = CURRENT_TIMESTAMP`,
        [ticketId, response.question_id, JSON.stringify(response.value)]
      );
    }

    // Logger dans l'historique
    await query(
      `INSERT INTO ticket_history (ticket_id, user_id, action, details)
       VALUES ($1, $2, 'dynamic_responses_updated', $3)`,
      [ticketId, req.user.id, JSON.stringify({ count: responses.length })]
    );

    res.json({ message: 'Réponses enregistrées', count: responses.length });
  } catch (err) {
    console.error('Erreur sauvegarde réponses:', err);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde' });
  }
});

// ====================================
// ROUTES ADMIN - Gestion des questions
// ====================================

// POST /api/dynamic-questions - Créer une question (admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      agency_id,
      problem_type_id,
      question_text,
      question_type,
      options,
      is_required,
      display_order,
      urgency_trigger,
      blocking_trigger,
      help_text,
      validation_rules
    } = req.body;

    if (!agency_id || !question_text || !question_type) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const validTypes = ['text', 'select', 'multiselect', 'boolean', 'number'];
    if (!validTypes.includes(question_type)) {
      return res.status(400).json({ error: 'Type de question invalide' });
    }

    const { rows } = await query(
      `INSERT INTO dynamic_questions
       (agency_id, problem_type_id, question_text, question_type, options,
        is_required, display_order, urgency_trigger, blocking_trigger, help_text, validation_rules)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        agency_id,
        problem_type_id || null,
        question_text,
        question_type,
        JSON.stringify(options || []),
        is_required || false,
        display_order || 0,
        urgency_trigger || [],
        blocking_trigger || [],
        help_text || null,
        JSON.stringify(validation_rules || {})
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur création question:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/dynamic-questions/:id - Modifier une question
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question_text,
      question_type,
      options,
      is_required,
      display_order,
      urgency_trigger,
      blocking_trigger,
      help_text,
      validation_rules,
      is_active
    } = req.body;

    const { rows } = await query(
      `UPDATE dynamic_questions SET
       question_text = COALESCE($1, question_text),
       question_type = COALESCE($2, question_type),
       options = COALESCE($3, options),
       is_required = COALESCE($4, is_required),
       display_order = COALESCE($5, display_order),
       urgency_trigger = COALESCE($6, urgency_trigger),
       blocking_trigger = COALESCE($7, blocking_trigger),
       help_text = COALESCE($8, help_text),
       validation_rules = COALESCE($9, validation_rules),
       is_active = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
      [
        question_text,
        question_type,
        options ? JSON.stringify(options) : null,
        is_required,
        display_order,
        urgency_trigger,
        blocking_trigger,
        help_text,
        validation_rules ? JSON.stringify(validation_rules) : null,
        is_active,
        id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification question:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE /api/dynamic-questions/:id - Désactiver une question
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // On ne supprime pas, on désactive
    const { rows } = await query(
      'UPDATE dynamic_questions SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Question non trouvée' });
    }

    res.json({ message: 'Question désactivée' });
  } catch (err) {
    console.error('Erreur désactivation question:', err);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

module.exports = router;
