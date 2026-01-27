const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// Middleware pour vérifier l'accès syndicat
const requireUnionAccess = async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur a un accès syndicat
    const hasUnionAccess = req.user.agency_accesses?.some(a => a.is_union_member);

    if (!hasUnionAccess && !['admin', 'admin_delegated'].includes(req.user.account_type)) {
      return res.status(403).json({ error: 'Accès syndicat requis' });
    }

    // Récupérer les agences accessibles en tant que syndicat
    req.unionAgencies = req.user.agency_accesses
      ?.filter(a => a.is_union_member)
      .map(a => a.agency_id) || [];

    next();
  } catch (err) {
    console.error('Erreur vérification accès syndicat:', err);
    res.status(500).json({ error: 'Erreur de vérification des accès' });
  }
};

router.use(authenticate);
router.use(requireUnionAccess);

// GET /api/union/dashboard - Dashboard syndicat
router.get('/dashboard', async (req, res) => {
  try {
    const { agency_id } = req.query;

    // Filtrer par agence si spécifié, sinon toutes les agences accessibles
    let agencyFilter = req.unionAgencies;
    if (agency_id && req.unionAgencies.includes(agency_id)) {
      agencyFilter = [agency_id];
    }

    if (agencyFilter.length === 0) {
      return res.json({
        stats: {},
        by_type: [],
        by_location: [],
        by_urgency: {},
        trends: []
      });
    }

    // Statistiques globales
    const { rows: statsRows } = await query(
      `SELECT
         COUNT(*) as total_tickets,
         COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END) as resolved_tickets,
         COUNT(CASE WHEN validated_urgency = 'critique' THEN 1 END) as critical_tickets,
         COUNT(CASE WHEN validated_urgency = 'haute' THEN 1 END) as high_tickets,
         ROUND(AVG(CASE WHEN resolved_at IS NOT NULL
           THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
         END)::numeric, 2) as avg_resolution_days,
         ROUND((COUNT(CASE WHEN resolved_at <= sla_resolution_deadline THEN 1 END)::numeric /
           NULLIF(COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END), 0) * 100)::numeric, 1) as sla_compliance
       FROM tickets
       WHERE is_visible_union = true
       AND agency_id = ANY($1)
       AND status NOT IN ('nouveau', 'en_attente_validation')`,
      [agencyFilter]
    );

    // Par type de problème
    const { rows: byType } = await query(
      `SELECT pt.name, pt.color, COUNT(*) as count
       FROM tickets t
       JOIN problem_types pt ON t.problem_type_id = pt.id
       WHERE t.is_visible_union = true
       AND t.agency_id = ANY($1)
       AND t.status NOT IN ('nouveau', 'en_attente_validation')
       GROUP BY pt.id, pt.name, pt.color
       ORDER BY count DESC
       LIMIT 10`,
      [agencyFilter]
    );

    // Par lieu
    const { rows: byLocation } = await query(
      `SELECT l.name, COUNT(*) as count
       FROM tickets t
       JOIN locations l ON t.primary_location_id = l.id
       WHERE t.is_visible_union = true
       AND t.agency_id = ANY($1)
       AND t.status NOT IN ('nouveau', 'en_attente_validation')
       GROUP BY l.id, l.name
       ORDER BY count DESC
       LIMIT 10`,
      [agencyFilter]
    );

    // Par urgence
    const { rows: byUrgency } = await query(
      `SELECT validated_urgency, COUNT(*) as count
       FROM tickets
       WHERE is_visible_union = true
       AND agency_id = ANY($1)
       AND status NOT IN ('nouveau', 'en_attente_validation')
       AND validated_urgency IS NOT NULL
       GROUP BY validated_urgency`,
      [agencyFilter]
    );

    const urgencyMap = byUrgency.reduce((acc, row) => {
      acc[row.validated_urgency] = parseInt(row.count);
      return acc;
    }, {});

    // Tendances mensuelles (6 derniers mois)
    const { rows: trends } = await query(
      `SELECT
         to_char(date_trunc('month', created_at), 'YYYY-MM') as period,
         COUNT(*) as total,
         COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END) as resolved
       FROM tickets
       WHERE is_visible_union = true
       AND agency_id = ANY($1)
       AND created_at >= CURRENT_DATE - INTERVAL '6 months'
       GROUP BY date_trunc('month', created_at)
       ORDER BY period`,
      [agencyFilter]
    );

    res.json({
      stats: statsRows[0] || {},
      by_type: byType,
      by_location: byLocation,
      by_urgency: urgencyMap,
      trends
    });
  } catch (err) {
    console.error('Erreur dashboard syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/union/tickets - Liste des tickets visibles au syndicat
router.get('/tickets', async (req, res) => {
  try {
    const {
      agency_id,
      status,
      urgency,
      problem_type_id,
      location_id,
      page = 1,
      limit = 20
    } = req.query;

    let agencyFilter = req.unionAgencies;
    if (agency_id && req.unionAgencies.includes(agency_id)) {
      agencyFilter = [agency_id];
    }

    if (agencyFilter.length === 0) {
      return res.json({ tickets: [], total: 0, page: 1, limit: 20 });
    }

    let sql = `
      SELECT
        t.id,
        t.ticket_number,
        t.title,
        a.name as agency_name,
        pt.name as problem_type_name,
        pt.color as problem_type_color,
        l.name as location_name,
        t.validated_urgency,
        t.validated_blocking,
        t.status,
        t.created_at,
        t.resolved_at,
        CASE
          WHEN t.sla_resolution_deadline IS NOT NULL AND t.resolved_at IS NOT NULL
          THEN t.resolved_at <= t.sla_resolution_deadline
          ELSE NULL
        END as sla_respected
      FROM tickets t
      JOIN agencies a ON t.agency_id = a.id
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      LEFT JOIN locations l ON t.primary_location_id = l.id
      WHERE t.is_visible_union = true
      AND t.agency_id = ANY($1)
      AND t.status NOT IN ('nouveau', 'en_attente_validation')
    `;

    const params = [agencyFilter];
    let paramIndex = 2;

    if (status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }

    if (urgency) {
      sql += ` AND t.validated_urgency = $${paramIndex++}`;
      params.push(urgency);
    }

    if (problem_type_id) {
      sql += ` AND t.problem_type_id = $${paramIndex++}`;
      params.push(problem_type_id);
    }

    if (location_id) {
      sql += ` AND t.primary_location_id = $${paramIndex++}`;
      params.push(location_id);
    }

    // Compter le total
    const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const { rows: countRows } = await query(countSql, params);
    const total = parseInt(countRows[0].total);

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` ORDER BY t.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), offset);

    const { rows } = await query(sql, params);

    res.json({
      tickets: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('Erreur liste tickets syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/union/tickets/:id - Détail d'un ticket (vue limitée)
router.get('/tickets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT
        t.id,
        t.ticket_number,
        t.title,
        -- Pas de description détaillée
        a.name as agency_name,
        pt.name as problem_type_name,
        pt.color as problem_type_color,
        l.name as location_name,
        t.validated_urgency,
        t.validated_blocking,
        t.status,
        t.recurrence,
        t.has_workaround,
        t.resolution_type,
        -- Pas de noms de personnes
        t.created_at,
        t.validated_at,
        t.resolved_at,
        t.closed_at,
        t.sla_response_deadline,
        t.sla_resolution_deadline,
        CASE
          WHEN t.sla_resolution_deadline IS NOT NULL AND t.resolved_at IS NOT NULL
          THEN t.resolved_at <= t.sla_resolution_deadline
          ELSE NULL
        END as sla_respected
       FROM tickets t
       JOIN agencies a ON t.agency_id = a.id
       LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
       LEFT JOIN locations l ON t.primary_location_id = l.id
       WHERE t.id = $1
       AND t.is_visible_union = true
       AND t.agency_id = ANY($2)
       AND t.status NOT IN ('nouveau', 'en_attente_validation')`,
      [id, req.unionAgencies]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé ou non accessible' });
    }

    // Récupérer l'historique des changements de statut (sans les noms)
    const { rows: history } = await query(
      `SELECT
        action,
        field_name,
        old_value,
        new_value,
        created_at
       FROM ticket_history
       WHERE ticket_id = $1
       AND action IN ('status_change', 'urgency_change', 'escalation')
       ORDER BY created_at`,
      [id]
    );

    res.json({
      ...rows[0],
      history
    });
  } catch (err) {
    console.error('Erreur détail ticket syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/union/agencies - Liste des agences accessibles
router.get('/agencies', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.name, a.code, a.city
       FROM agencies a
       WHERE a.id = ANY($1)
       AND a.is_active = true
       ORDER BY a.name`,
      [req.unionAgencies]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur liste agences syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/union/stats/comparison - Comparaison entre agences
router.get('/stats/comparison', async (req, res) => {
  try {
    if (req.unionAgencies.length < 2) {
      return res.json({ agencies: [] });
    }

    const { rows } = await query(
      `SELECT
        a.id,
        a.name,
        a.code,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status IN ('resolu', 'cloture') THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN t.validated_urgency = 'critique' THEN 1 END) as critical_tickets,
        ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 86400
        END)::numeric, 2) as avg_resolution_days,
        ROUND((COUNT(CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
          NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100)::numeric, 1) as sla_compliance
       FROM agencies a
       LEFT JOIN tickets t ON a.id = t.agency_id AND t.is_visible_union = true
       WHERE a.id = ANY($1)
       GROUP BY a.id, a.name, a.code
       ORDER BY a.name`,
      [req.unionAgencies]
    );

    res.json({ agencies: rows });
  } catch (err) {
    console.error('Erreur comparaison agences syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/union/filters - Options de filtres disponibles
router.get('/filters', async (req, res) => {
  try {
    const { agency_id } = req.query;

    let agencyFilter = req.unionAgencies;
    if (agency_id && req.unionAgencies.includes(agency_id)) {
      agencyFilter = [agency_id];
    }

    // Types de problèmes
    const { rows: problemTypes } = await query(
      `SELECT DISTINCT pt.id, pt.name, pt.color
       FROM problem_types pt
       JOIN tickets t ON pt.id = t.problem_type_id
       WHERE t.is_visible_union = true
       AND t.agency_id = ANY($1)
       ORDER BY pt.name`,
      [agencyFilter]
    );

    // Lieux
    const { rows: locations } = await query(
      `SELECT DISTINCT l.id, l.name
       FROM locations l
       JOIN tickets t ON l.id = t.primary_location_id
       WHERE t.is_visible_union = true
       AND t.agency_id = ANY($1)
       ORDER BY l.name`,
      [agencyFilter]
    );

    res.json({
      problem_types: problemTypes,
      locations,
      urgencies: ['critique', 'haute', 'moyenne', 'basse'],
      statuses: ['en_analyse', 'en_cours', 'resolu', 'cloture']
    });
  } catch (err) {
    console.error('Erreur filtres syndicat:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

module.exports = router;
