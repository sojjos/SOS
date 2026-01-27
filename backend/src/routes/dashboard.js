const express = require('express');
const { query } = require('../config/database');
const { authenticate, requireAgencyAccess } = require('../middlewares/auth');

const router = express.Router();

// ====================================
// GET /api/dashboard/personal - Dashboard personnel
// ====================================
router.get('/personal', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { agency_id, period = '30' } = req.query;

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Mes tickets ouverts
    const { rows: openTickets } = await query(`
      SELECT COUNT(*) as count FROM tickets
      WHERE created_by = $1
      AND status NOT IN ('resolu', 'cloture')
      ${agency_id ? 'AND agency_id = $3' : ''}
    `, agency_id ? [userId, agency_id] : [userId]);

    // Mes tickets en attente de réponse
    const { rows: pendingTickets } = await query(`
      SELECT COUNT(*) as count FROM tickets
      WHERE created_by = $1
      AND status = 'en_attente_validation'
    `, [userId]);

    // Mes tickets résolus (période)
    const { rows: resolvedTickets } = await query(`
      SELECT COUNT(*) as count FROM tickets
      WHERE created_by = $1
      AND status IN ('resolu', 'cloture')
      AND resolved_at >= $2
    `, [userId, startDate]);

    // Mon délai moyen
    const { rows: avgDelay } = await query(`
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)::numeric, 1) as avg_days
      FROM tickets
      WHERE created_by = $1
      AND resolved_at IS NOT NULL
      AND resolved_at >= $2
    `, [userId, startDate]);

    // Mes derniers tickets
    const { rows: recentTickets } = await query(`
      SELECT t.*, pt.name as problem_type_name, l.name as location_name
      FROM tickets t
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      LEFT JOIN locations l ON t.primary_location_id = l.id
      WHERE t.created_by = $1
      ORDER BY t.created_at DESC
      LIMIT 5
    `, [userId]);

    // Historique création (par semaine)
    const { rows: weeklyHistory } = await query(`
      SELECT
        DATE_TRUNC('week', created_at) as week,
        COUNT(*) as created,
        COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END) as resolved
      FROM tickets
      WHERE created_by = $1
      AND created_at >= $2
      GROUP BY DATE_TRUNC('week', created_at)
      ORDER BY week
    `, [userId, startDate]);

    res.json({
      stats: {
        open: parseInt(openTickets[0].count),
        pending: parseInt(pendingTickets[0].count),
        resolved: parseInt(resolvedTickets[0].count),
        avgDelay: avgDelay[0].avg_days || 0
      },
      recentTickets,
      weeklyHistory
    });
  } catch (err) {
    console.error('Erreur dashboard personnel:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ====================================
// GET /api/dashboard/team - Dashboard équipe
// ====================================
router.get('/team', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const { agency_id, period = '30' } = req.query;

    if (!agency_id) {
      return res.status(400).json({ error: 'agency_id requis' });
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Tickets à valider
    const { rows: pendingValidation } = await query(`
      SELECT t.*, uc.first_name || ' ' || uc.last_name as created_by_name,
             pt.name as problem_type_name
      FROM tickets t
      LEFT JOIN users uc ON t.created_by = uc.id
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      WHERE t.agency_id = $1
      AND t.status = 'en_attente_validation'
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [agency_id]);

    // Stats équipe
    const { rows: teamStats } = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status NOT IN ('resolu', 'cloture') THEN 1 END) as open,
        COUNT(CASE WHEN status IN ('resolu', 'cloture') AND resolved_at >= $2 THEN 1 END) as resolved,
        ROUND(
          COUNT(CASE WHEN resolved_at <= sla_resolution_deadline THEN 1 END)::numeric /
          NULLIF(COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END), 0) * 100
        , 1) as sla_percent,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)::numeric, 1) as avg_days
      FROM tickets
      WHERE agency_id = $1
      AND created_at >= $2
    `, [agency_id, startDate]);

    // Performance par membre
    const { rows: memberPerformance } = await query(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name as name,
        COUNT(*) as treated,
        COUNT(CASE WHEN t.status IN ('resolu', 'cloture') THEN 1 END) as resolved,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 86400)::numeric, 1) as avg_days,
        ROUND(
          COUNT(CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
          NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100
        , 1) as sla_percent
      FROM tickets t
      JOIN users u ON t.current_responsible = u.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY resolved DESC
      LIMIT 10
    `, [agency_id, startDate]);

    // Tickets par lieu
    const { rows: byLocation } = await query(`
      SELECT l.name, COUNT(*) as count
      FROM tickets t
      JOIN locations l ON t.primary_location_id = l.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY l.id, l.name
      ORDER BY count DESC
      LIMIT 5
    `, [agency_id, startDate]);

    // Alertes SLA
    const { rows: slaAlerts } = await query(`
      SELECT t.*, pt.name as problem_type_name
      FROM tickets t
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      WHERE t.agency_id = $1
      AND t.status NOT IN ('resolu', 'cloture')
      AND t.sla_resolution_deadline IS NOT NULL
      AND t.sla_resolution_deadline < NOW() + INTERVAL '24 hours'
      ORDER BY t.sla_resolution_deadline ASC
      LIMIT 5
    `, [agency_id]);

    res.json({
      pendingValidation,
      stats: teamStats[0] || {},
      memberPerformance,
      byLocation,
      slaAlerts
    });
  } catch (err) {
    console.error('Erreur dashboard équipe:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ====================================
// GET /api/dashboard/site - Dashboard site
// ====================================
router.get('/site', authenticate, async (req, res) => {
  try {
    const { agency_id, period = '30' } = req.query;

    if (!agency_id) {
      return res.status(400).json({ error: 'agency_id requis' });
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Stats globales
    const { rows: globalStats } = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status NOT IN ('resolu', 'cloture') THEN 1 END) as open,
        COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END) as resolved,
        COUNT(CASE WHEN sla_resolution_deadline < NOW() AND status NOT IN ('resolu', 'cloture') THEN 1 END) as sla_exceeded,
        ROUND(
          COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100
        , 1) as resolution_rate,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)::numeric, 1) as avg_days
      FROM tickets
      WHERE agency_id = $1
      AND created_at >= $2
    `, [agency_id, startDate]);

    // Par niveau hiérarchique
    const { rows: byLevel } = await query(`
      SELECT
        created_at_level as level,
        COUNT(*) as created,
        COUNT(CASE WHEN resolved_at_level = created_at_level THEN 1 END) as resolved_same_level
      FROM tickets
      WHERE agency_id = $1
      AND created_at >= $2
      GROUP BY created_at_level
      ORDER BY created_at_level
    `, [agency_id, startDate]);

    // Par urgence
    const { rows: byUrgency } = await query(`
      SELECT
        COALESCE(validated_urgency, proposed_urgency) as urgency,
        COUNT(*) as count
      FROM tickets
      WHERE agency_id = $1
      AND created_at >= $2
      GROUP BY COALESCE(validated_urgency, proposed_urgency)
    `, [agency_id, startDate]);

    // Par type de problème
    const { rows: byType } = await query(`
      SELECT pt.name, COUNT(*) as count
      FROM tickets t
      JOIN problem_types pt ON t.problem_type_id = pt.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY pt.id, pt.name
      ORDER BY count DESC
    `, [agency_id, startDate]);

    // Top lieux impactés
    const { rows: topLocations } = await query(`
      SELECT
        l.name,
        COUNT(*) as total,
        COUNT(CASE WHEN t.validated_urgency = 'critique' THEN 1 END) as critical
      FROM tickets t
      JOIN locations l ON t.primary_location_id = l.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY l.id, l.name
      ORDER BY total DESC
      LIMIT 5
    `, [agency_id, startDate]);

    // Problèmes récurrents
    const { rows: recurrent } = await query(`
      SELECT
        title,
        COUNT(*) as occurrences,
        pt.name as problem_type
      FROM tickets t
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      WHERE t.agency_id = $1
      AND t.recurrence = 'recurrent'
      AND t.created_at >= $2
      GROUP BY t.title, pt.name
      ORDER BY occurrences DESC
      LIMIT 5
    `, [agency_id, startDate]);

    res.json({
      stats: globalStats[0] || {},
      byLevel,
      byUrgency,
      byType,
      topLocations,
      recurrent
    });
  } catch (err) {
    console.error('Erreur dashboard site:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ====================================
// GET /api/dashboard/direction - Dashboard direction
// ====================================
router.get('/direction', authenticate, async (req, res) => {
  try {
    const { agency_id, period = '30', compare_period } = req.query;

    if (!agency_id) {
      return res.status(400).json({ error: 'agency_id requis' });
    }

    const periodDays = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Stats comparatives (si période de comparaison)
    let comparePreviousStart = null;
    let comparePreviousEnd = null;
    if (compare_period) {
      comparePreviousEnd = new Date(startDate);
      comparePreviousStart = new Date(startDate);
      comparePreviousStart.setDate(comparePreviousStart.getDate() - periodDays);
    }

    // Performance par responsable
    const { rows: byResponsible } = await query(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name as name,
        hl.level_number,
        hl.name as level_name,
        COUNT(*) as treated,
        COUNT(CASE WHEN t.status IN ('resolu', 'cloture') THEN 1 END) as resolved,
        ROUND(AVG(EXTRACT(EPOCH FROM (t.resolved_at - t.validated_at)) / 86400)::numeric, 1) as avg_days,
        ROUND(
          COUNT(CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
          NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100
        , 1) as sla_percent,
        ROUND(
          COUNT(CASE WHEN te.id IS NOT NULL THEN 1 END)::numeric /
          NULLIF(COUNT(*), 0) * 100
        , 1) as escalation_rate
      FROM tickets t
      JOIN users u ON t.current_responsible = u.id
      LEFT JOIN user_agency_access uaa ON u.id = uaa.user_id AND uaa.agency_id = t.agency_id
      LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
      LEFT JOIN ticket_escalations te ON t.id = te.ticket_id AND te.from_user_id = u.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY u.id, u.first_name, u.last_name, hl.level_number, hl.name
      ORDER BY resolved DESC
    `, [agency_id, startDate]);

    // Où sont résolus les tickets (par niveau)
    const { rows: resolutionByLevel } = await query(`
      SELECT
        created_at_level,
        resolved_at_level,
        COUNT(*) as count
      FROM tickets
      WHERE agency_id = $1
      AND created_at >= $2
      AND resolved_at IS NOT NULL
      GROUP BY created_at_level, resolved_at_level
      ORDER BY created_at_level, resolved_at_level
    `, [agency_id, startDate]);

    // Taux d'escalade par niveau
    const { rows: escalationByLevel } = await query(`
      SELECT
        from_level,
        COUNT(*) as escalations
      FROM ticket_escalations te
      JOIN tickets t ON te.ticket_id = t.id
      WHERE t.agency_id = $1
      AND te.created_at >= $2
      GROUP BY from_level
      ORDER BY from_level
    `, [agency_id, startDate]);

    // Évolution délais (par semaine)
    const { rows: delayTrend } = await query(`
      SELECT
        DATE_TRUNC('week', resolved_at) as week,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400)::numeric, 1) as avg_days
      FROM tickets
      WHERE agency_id = $1
      AND resolved_at >= $2
      GROUP BY DATE_TRUNC('week', resolved_at)
      ORDER BY week
    `, [agency_id, startDate]);

    // Pareto types de problèmes
    const { rows: paretoTypes } = await query(`
      SELECT
        pt.name,
        COUNT(*) as count,
        ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER() * 100, 1) as percent
      FROM tickets t
      JOIN problem_types pt ON t.problem_type_id = pt.id
      WHERE t.agency_id = $1
      AND t.created_at >= $2
      GROUP BY pt.id, pt.name
      ORDER BY count DESC
    `, [agency_id, startDate]);

    res.json({
      byResponsible,
      resolutionByLevel,
      escalationByLevel,
      delayTrend,
      paretoTypes
    });
  } catch (err) {
    console.error('Erreur dashboard direction:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ====================================
// GET /api/dashboard/multi-sites - Dashboard multi-sites (Admin)
// ====================================
router.get('/multi-sites', authenticate, async (req, res) => {
  try {
    const user = req.user;
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    // Parse period parameter (format: "7days", "30days", "90days", "365days")
    const { period = '30days' } = req.query;
    const periodMatch = period.match(/(\d+)/);
    const periodDays = periodMatch ? parseInt(periodMatch[1]) : 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Période précédente pour comparaison
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    // Statistiques par agence
    const { rows: agencies } = await query(`
      SELECT
        a.id,
        a.name,
        a.code,
        COUNT(t.id) as total_tickets,
        COUNT(CASE WHEN t.status NOT IN ('resolu', 'cloture') THEN 1 END) as active_tickets,
        COUNT(CASE WHEN t.validated_urgency = 'critique' AND t.status NOT IN ('resolu', 'cloture') THEN 1 END) as critical_active,
        COUNT(CASE WHEN t.status IN ('resolu', 'cloture') AND t.resolved_at >= $1 THEN 1 END) as resolved_this_month,
        ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 86400 END)::numeric, 1) as avg_resolution_days,
        ROUND(
          COUNT(CASE WHEN t.resolved_at IS NOT NULL AND t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
          NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100
        , 1) as sla_compliance
      FROM agencies a
      LEFT JOIN tickets t ON a.id = t.agency_id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.code
      ORDER BY a.name
    `, [startDate]);

    // Statistiques globales
    const { rows: globalRows } = await query(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status NOT IN ('resolu', 'cloture') THEN 1 END) as active_tickets,
        COUNT(CASE WHEN status IN ('resolu', 'cloture') AND resolved_at >= $1 THEN 1 END) as resolved_period,
        COUNT(CASE WHEN validated_urgency = 'critique' AND status NOT IN ('resolu', 'cloture') THEN 1 END) as critical_active
      FROM tickets
    `, [startDate]);

    // Stats période précédente pour comparaison
    const { rows: previousRows } = await query(`
      SELECT
        COUNT(*) as previous_total,
        COUNT(CASE WHEN status IN ('resolu', 'cloture') AND resolved_at >= $1 AND resolved_at < $2 THEN 1 END) as previous_resolved
      FROM tickets
    `, [previousStartDate, startDate]);

    const global_stats = {
      ...globalRows[0],
      previous_total: previousRows[0]?.previous_total || 0,
      previous_resolved: previousRows[0]?.previous_resolved || 0
    };

    // Tendances par semaine
    const { rows: trendsRaw } = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('week', t.created_at), 'DD/MM') as period,
        t.agency_id,
        COUNT(*) as count
      FROM tickets t
      WHERE t.created_at >= $1
      GROUP BY DATE_TRUNC('week', t.created_at), t.agency_id
      ORDER BY DATE_TRUNC('week', t.created_at)
    `, [startDate]);

    // Transformer les tendances
    const trendsMap = {};
    trendsRaw.forEach(row => {
      if (!trendsMap[row.period]) {
        trendsMap[row.period] = { period: row.period, by_agency: {} };
      }
      trendsMap[row.period].by_agency[row.agency_id] = parseInt(row.count);
    });
    const trends = Object.values(trendsMap);

    // Alertes
    const alerts = [];

    // Vérifier SLA dépassés
    const { rows: slaAlerts } = await query(`
      SELECT COUNT(*) as count, a.name as agency_name
      FROM tickets t
      JOIN agencies a ON t.agency_id = a.id
      WHERE t.sla_resolution_deadline < NOW()
      AND t.status NOT IN ('resolu', 'cloture')
      GROUP BY a.name
      HAVING COUNT(*) > 3
    `);
    slaAlerts.forEach(alert => {
      alerts.push({
        type: 'sla',
        message: `${alert.agency_name}: ${alert.count} tickets ont dépassé leur SLA`
      });
    });

    // Vérifier tickets critiques anciens
    const { rows: criticalAlerts } = await query(`
      SELECT COUNT(*) as count, a.name as agency_name
      FROM tickets t
      JOIN agencies a ON t.agency_id = a.id
      WHERE t.validated_urgency = 'critique'
      AND t.status NOT IN ('resolu', 'cloture')
      AND t.created_at < NOW() - INTERVAL '7 days'
      GROUP BY a.name
      HAVING COUNT(*) > 0
    `);
    criticalAlerts.forEach(alert => {
      alerts.push({
        type: 'critical',
        message: `${alert.agency_name}: ${alert.count} ticket(s) critique(s) non résolu(s) depuis plus de 7 jours`
      });
    });

    res.json({
      agencies,
      global_stats,
      trends,
      alerts
    });
  } catch (err) {
    console.error('Erreur dashboard multi-sites:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

module.exports = router;
