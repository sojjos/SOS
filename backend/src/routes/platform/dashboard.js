const express = require('express');
const { query } = require('../../config/database');
const { authenticatePlatformAdmin } = require('./auth');

const router = express.Router();

// Tous les endpoints nécessitent une authentification platform admin
router.use(authenticatePlatformAdmin);

// ====================================
// GET /api/platform/dashboard - Vue d'ensemble
// ====================================
router.get('/', async (req, res) => {
  try {
    // Statistiques globales
    const { rows: globalStats } = await query(`
      SELECT
        (SELECT COUNT(*) FROM companies WHERE is_active = true) as total_companies,
        (SELECT COUNT(*) FROM companies WHERE subscription_status = 'trial') as trial_companies,
        (SELECT COUNT(*) FROM companies WHERE subscription_status = 'active') as active_companies,
        (SELECT COUNT(*) FROM companies WHERE subscription_status = 'suspended') as suspended_companies,
        (SELECT COUNT(*) FROM agencies WHERE is_active = true) as total_sites,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(*) FROM users WHERE account_type = 'admin' AND is_active = true) as total_admins,
        (SELECT COUNT(*) FROM tickets) as total_tickets,
        (SELECT COUNT(*) FROM tickets WHERE status NOT IN ('resolu', 'cloture')) as open_tickets,
        (SELECT COUNT(*) FROM tickets WHERE created_at >= NOW() - INTERVAL '24 hours') as tickets_24h,
        (SELECT COUNT(*) FROM tickets WHERE created_at >= NOW() - INTERVAL '7 days') as tickets_7d
    `);

    // Entreprises récentes
    const { rows: recentCompanies } = await query(`
      SELECT
        c.id, c.name, c.slug, c.subscription_plan, c.subscription_status,
        c.current_sites_count, c.current_users_count, c.created_at,
        (SELECT COUNT(*) FROM tickets t JOIN agencies a ON t.agency_id = a.id WHERE a.company_id = c.id) as tickets_count
      FROM companies c
      WHERE c.is_active = true
      ORDER BY c.created_at DESC
      LIMIT 5
    `);

    // Entreprises nécessitant attention (quotas dépassés, trial expirant)
    const { rows: alertCompanies } = await query(`
      SELECT c.id, c.name, c.slug, c.subscription_status, c.trial_ends_at,
        c.current_sites_count, c.max_sites,
        c.current_users_count, c.max_users,
        CASE
          WHEN c.subscription_status = 'trial' AND c.trial_ends_at <= NOW() + INTERVAL '7 days' THEN 'trial_expiring'
          WHEN c.current_sites_count >= c.max_sites THEN 'sites_limit'
          WHEN c.current_users_count >= c.max_users THEN 'users_limit'
          ELSE NULL
        END as alert_type
      FROM companies c
      WHERE c.is_active = true
      AND (
        (c.subscription_status = 'trial' AND c.trial_ends_at <= NOW() + INTERVAL '7 days')
        OR c.current_sites_count >= c.max_sites
        OR c.current_users_count >= c.max_users
      )
      ORDER BY c.trial_ends_at ASC NULLS LAST
      LIMIT 10
    `);

    // Top entreprises par activité
    const { rows: topCompanies } = await query(`
      SELECT
        c.id, c.name, c.slug,
        COUNT(t.id) as tickets_count,
        COUNT(CASE WHEN t.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as tickets_7d
      FROM companies c
      JOIN agencies a ON a.company_id = c.id
      JOIN tickets t ON t.agency_id = a.id
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.slug
      ORDER BY tickets_7d DESC
      LIMIT 5
    `);

    // Activité récente
    const { rows: recentActivity } = await query(`
      SELECT
        pl.id, pl.action, pl.entity_type, pl.created_at, pl.details,
        c.name as company_name,
        pa.email as admin_email, pa.first_name as admin_first_name, pa.last_name as admin_last_name
      FROM platform_logs pl
      LEFT JOIN companies c ON pl.company_id = c.id
      LEFT JOIN platform_admins pa ON pl.platform_admin_id = pa.id
      ORDER BY pl.created_at DESC
      LIMIT 20
    `);

    res.json({
      stats: globalStats[0],
      recentCompanies,
      alertCompanies,
      topCompanies,
      recentActivity
    });
  } catch (err) {
    console.error('Erreur dashboard platform:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du dashboard' });
  }
});

// ====================================
// GET /api/platform/dashboard/stats - Statistiques détaillées
// ====================================
router.get('/stats', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const periodDays = parseInt(period) || 30;

    // Évolution des entreprises
    const { rows: companiesGrowth } = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM companies
      WHERE created_at >= NOW() - INTERVAL '${periodDays} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Évolution des utilisateurs
    const { rows: usersGrowth } = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${periodDays} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Évolution des tickets
    const { rows: ticketsGrowth } = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM tickets
      WHERE created_at >= NOW() - INTERVAL '${periodDays} days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    // Répartition par plan
    const { rows: planDistribution } = await query(`
      SELECT subscription_plan as plan, COUNT(*) as count
      FROM companies
      WHERE is_active = true
      GROUP BY subscription_plan
      ORDER BY count DESC
    `);

    // Répartition par statut
    const { rows: statusDistribution } = await query(`
      SELECT subscription_status as status, COUNT(*) as count
      FROM companies
      GROUP BY subscription_status
      ORDER BY count DESC
    `);

    // Utilisation des quotas
    const { rows: quotaUsage } = await query(`
      SELECT
        ROUND(AVG(current_sites_count::numeric / NULLIF(max_sites, 0) * 100), 1) as avg_sites_usage,
        ROUND(AVG(current_users_count::numeric / NULLIF(max_users, 0) * 100), 1) as avg_users_usage,
        COUNT(CASE WHEN current_sites_count >= max_sites THEN 1 END) as at_sites_limit,
        COUNT(CASE WHEN current_users_count >= max_users THEN 1 END) as at_users_limit
      FROM companies
      WHERE is_active = true
    `);

    res.json({
      companiesGrowth,
      usersGrowth,
      ticketsGrowth,
      planDistribution,
      statusDistribution,
      quotaUsage: quotaUsage[0],
      period: periodDays
    });
  } catch (err) {
    console.error('Erreur stats platform:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// ====================================
// GET /api/platform/dashboard/health - Santé du système
// ====================================
router.get('/health', async (req, res) => {
  try {
    // Test de connexion à la base
    const dbStart = Date.now();
    await query('SELECT 1');
    const dbLatency = Date.now() - dbStart;

    // Statistiques de la base
    const { rows: dbStats } = await query(`
      SELECT
        pg_database_size(current_database()) as db_size,
        (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT COUNT(*) FROM pg_stat_activity) as total_connections
    `);

    // Compter les erreurs récentes
    const { rows: errorCount } = await query(`
      SELECT COUNT(*) as count
      FROM platform_logs
      WHERE action LIKE '%error%' OR action LIKE '%failed%'
      AND created_at >= NOW() - INTERVAL '24 hours'
    `);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        latencyMs: dbLatency,
        sizeBytes: parseInt(dbStats[0].db_size),
        activeConnections: parseInt(dbStats[0].active_connections),
        totalConnections: parseInt(dbStats[0].total_connections)
      },
      errors24h: parseInt(errorCount[0].count)
    });
  } catch (err) {
    console.error('Erreur health platform:', err);
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ====================================
// GET /api/platform/dashboard/logs - Logs de la plateforme
// ====================================
router.get('/logs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      companyId,
      adminId,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (action) {
      params.push(`%${action}%`);
      whereClause += ` AND pl.action ILIKE $${params.length}`;
    }

    if (companyId) {
      params.push(companyId);
      whereClause += ` AND pl.company_id = $${params.length}`;
    }

    if (adminId) {
      params.push(adminId);
      whereClause += ` AND pl.platform_admin_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      whereClause += ` AND pl.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      whereClause += ` AND pl.created_at <= $${params.length}`;
    }

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM platform_logs pl ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch logs
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT
        pl.*,
        c.name as company_name,
        pa.email as admin_email,
        pa.first_name || ' ' || pa.last_name as admin_name
      FROM platform_logs pl
      LEFT JOIN companies c ON pl.company_id = c.id
      LEFT JOIN platform_admins pa ON pl.platform_admin_id = pa.id
      ${whereClause}
      ORDER BY pl.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      logs: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Erreur logs platform:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
});

module.exports = router;
