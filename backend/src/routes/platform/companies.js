const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult, query: checkQuery } = require('express-validator');
const { query } = require('../../config/database');
const { authenticatePlatformAdmin } = require('./auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Tous les endpoints nécessitent une authentification platform admin
router.use(authenticatePlatformAdmin);

// ====================================
// GET /api/platform/companies - Liste des entreprises
// ====================================
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      plan,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (c.name ILIKE $${params.length} OR c.slug ILIKE $${params.length} OR c.contact_email ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND c.subscription_status = $${params.length}`;
    }

    if (plan) {
      params.push(plan);
      whereClause += ` AND c.subscription_plan = $${params.length}`;
    }

    // Valider sortBy pour éviter injection SQL
    const allowedSortFields = ['created_at', 'name', 'current_users_count', 'current_sites_count', 'subscription_status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM companies c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch companies
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT
        c.*,
        (SELECT COUNT(*) FROM agencies a WHERE a.company_id = c.id) as sites_count,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.is_active = true) as users_count,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.account_type = 'admin') as admins_count,
        (SELECT COUNT(*) FROM tickets t JOIN agencies a ON t.agency_id = a.id WHERE a.company_id = c.id) as tickets_count
      FROM companies c
      ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      companies: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Erreur liste companies:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des entreprises' });
  }
});

// ====================================
// GET /api/platform/companies/:id - Détail d'une entreprise
// ====================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT
        c.*,
        (SELECT COUNT(*) FROM agencies a WHERE a.company_id = c.id AND a.is_active = true) as active_sites_count,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.is_active = true) as active_users_count,
        (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.account_type = 'admin' AND u.is_active = true) as active_admins_count
      FROM companies c
      WHERE c.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    const company = rows[0];

    // Récupérer les agences de l'entreprise
    const { rows: agencies } = await query(
      `SELECT a.*,
        (SELECT COUNT(*) FROM tickets t WHERE t.agency_id = a.id) as tickets_count,
        (SELECT COUNT(*) FROM user_agency_access uaa WHERE uaa.agency_id = a.id AND uaa.is_active = true) as users_count
      FROM agencies a
      WHERE a.company_id = $1
      ORDER BY a.name`,
      [id]
    );

    // Récupérer les admins de l'entreprise
    const { rows: admins } = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.account_type, u.is_active, u.last_login, u.created_at
      FROM users u
      WHERE u.company_id = $1 AND u.account_type IN ('admin', 'admin_delegated')
      ORDER BY u.created_at`,
      [id]
    );

    // Récupérer les codes d'invitation actifs
    const { rows: invitationCodes } = await query(
      `SELECT ic.*
      FROM invitation_codes ic
      WHERE ic.company_id = $1 AND ic.is_active = true
      ORDER BY ic.created_at DESC
      LIMIT 10`,
      [id]
    );

    res.json({
      company,
      agencies,
      admins,
      invitationCodes
    });
  } catch (err) {
    console.error('Erreur détail company:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'entreprise' });
  }
});

// ====================================
// POST /api/platform/companies - Créer une entreprise
// ====================================
router.post('/', [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/).withMessage('Slug invalide (lettres minuscules, chiffres et tirets uniquement)'),
  body('contactEmail').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('subscriptionPlan').optional().isIn(['starter', 'professional', 'enterprise', 'unlimited']),
  body('maxSites').optional().isInt({ min: 1 }),
  body('maxUsers').optional().isInt({ min: 1 }),
  body('maxAdmins').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      slug,
      contactEmail,
      contactPhone,
      contactName,
      address,
      city,
      postalCode,
      country,
      subscriptionPlan = 'starter',
      maxSites = 5,
      maxUsers = 50,
      maxAdmins = 3,
      trialDays = 30
    } = req.body;

    // Vérifier l'unicité du slug
    const { rows: existing } = await query(
      'SELECT id FROM companies WHERE slug = $1',
      [slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ce slug est déjà utilisé' });
    }

    // Calculer la date de fin d'essai
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Créer l'entreprise
    const { rows } = await query(
      `INSERT INTO companies (
        name, slug, contact_email, contact_phone, contact_name,
        address, city, postal_code, country,
        subscription_plan, subscription_status, max_sites, max_users, max_admins,
        trial_ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'trial', $11, $12, $13, $14)
      RETURNING *`,
      [
        name, slug, contactEmail, contactPhone || null, contactName || null,
        address || null, city || null, postalCode || null, country || 'Belgique',
        subscriptionPlan, maxSites, maxUsers, maxAdmins, trialEndsAt
      ]
    );

    const company = rows[0];

    // Générer un code d'invitation pour le premier admin
    const adminInviteCode = `ADM-${uuidv4().substring(0, 8).toUpperCase()}`;
    await query(
      `INSERT INTO invitation_codes (company_id, code, code_type, max_uses, created_by_platform_admin, expires_at)
       VALUES ($1, $2, 'admin_invite', 1, $3, $4)`,
      [company.id, adminInviteCode, req.platformAdmin.id, trialEndsAt]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'company_created', 'company', $3, $4, $5)`,
      [
        req.platformAdmin.id,
        company.id,
        company.id,
        JSON.stringify({ name, slug, plan: subscriptionPlan }),
        req.ip
      ]
    );

    res.status(201).json({
      company,
      adminInviteCode,
      message: 'Entreprise créée avec succès'
    });
  } catch (err) {
    console.error('Erreur création company:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'entreprise' });
  }
});

// ====================================
// PUT /api/platform/companies/:id - Modifier une entreprise
// ====================================
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Nom invalide'),
  body('contactEmail').optional().isEmail().normalizeEmail().withMessage('Email invalide'),
  body('subscriptionPlan').optional().isIn(['starter', 'professional', 'enterprise', 'unlimited']),
  body('subscriptionStatus').optional().isIn(['trial', 'active', 'suspended', 'cancelled']),
  body('maxSites').optional().isInt({ min: 1 }),
  body('maxUsers').optional().isInt({ min: 1 }),
  body('maxAdmins').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Vérifier que l'entreprise existe
    const { rows: existing } = await query(
      'SELECT * FROM companies WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    const oldCompany = existing[0];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'name', 'contact_email', 'contact_phone', 'contact_name',
      'address', 'city', 'postal_code', 'country', 'logo_url', 'primary_color',
      'subscription_plan', 'subscription_status', 'subscription_ends_at',
      'max_sites', 'max_users', 'max_admins', 'storage_limit_mb', 'is_active'
    ];

    const fieldMapping = {
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      contactName: 'contact_name',
      postalCode: 'postal_code',
      logoUrl: 'logo_url',
      primaryColor: 'primary_color',
      subscriptionPlan: 'subscription_plan',
      subscriptionStatus: 'subscription_status',
      subscriptionEndsAt: 'subscription_ends_at',
      maxSites: 'max_sites',
      maxUsers: 'max_users',
      maxAdmins: 'max_admins',
      storageLimitMb: 'storage_limit_mb',
      isActive: 'is_active'
    };

    for (const [key, value] of Object.entries(req.body)) {
      const dbField = fieldMapping[key] || key;
      if (allowedFields.includes(dbField) && value !== undefined) {
        updates.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    values.push(id);
    const { rows } = await query(
      `UPDATE companies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'company_updated', 'company', $3, $4, $5)`,
      [
        req.platformAdmin.id,
        id,
        id,
        JSON.stringify({ changes: req.body }),
        req.ip
      ]
    );

    res.json({
      company: rows[0],
      message: 'Entreprise modifiée avec succès'
    });
  } catch (err) {
    console.error('Erreur modification company:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'entreprise' });
  }
});

// ====================================
// DELETE /api/platform/companies/:id - Supprimer une entreprise
// ====================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'entreprise existe
    const { rows: existing } = await query(
      'SELECT * FROM companies WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Entreprise non trouvée' });
    }

    const company = existing[0];

    // Vérifier qu'il n'y a pas de données importantes
    const { rows: stats } = await query(
      `SELECT
        (SELECT COUNT(*) FROM agencies WHERE company_id = $1) as sites_count,
        (SELECT COUNT(*) FROM users WHERE company_id = $1) as users_count`,
      [id]
    );

    if (parseInt(stats[0].sites_count) > 0 || parseInt(stats[0].users_count) > 0) {
      // Soft delete
      await query(
        'UPDATE companies SET is_active = false, subscription_status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id, 'cancelled']
      );

      await query(
        `INSERT INTO platform_logs (platform_admin_id, company_id, action, entity_type, entity_id, details, ip_address)
         VALUES ($1, $2, 'company_deactivated', 'company', $3, $4, $5)`,
        [
          req.platformAdmin.id,
          id,
          id,
          JSON.stringify({ name: company.name, reason: 'soft_delete' }),
          req.ip
        ]
      );

      return res.json({ message: 'Entreprise désactivée (données existantes)' });
    }

    // Hard delete si pas de données
    await query('DELETE FROM companies WHERE id = $1', [id]);

    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'company_deleted', 'company', $2, $3, $4)`,
      [
        req.platformAdmin.id,
        id,
        JSON.stringify({ name: company.name }),
        req.ip
      ]
    );

    res.json({ message: 'Entreprise supprimée' });
  } catch (err) {
    console.error('Erreur suppression company:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'entreprise' });
  }
});

// ====================================
// GET /api/platform/companies/:id/stats - Statistiques détaillées
// ====================================
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    // Calculer la période
    const periodDays = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Stats générales
    const { rows: generalStats } = await query(
      `SELECT
        (SELECT COUNT(*) FROM agencies WHERE company_id = $1 AND is_active = true) as active_sites,
        (SELECT COUNT(*) FROM users WHERE company_id = $1 AND is_active = true) as active_users,
        (SELECT COUNT(*) FROM tickets t JOIN agencies a ON t.agency_id = a.id WHERE a.company_id = $1) as total_tickets,
        (SELECT COUNT(*) FROM tickets t JOIN agencies a ON t.agency_id = a.id WHERE a.company_id = $1 AND t.created_at >= $2) as recent_tickets,
        (SELECT COUNT(*) FROM tickets t JOIN agencies a ON t.agency_id = a.id WHERE a.company_id = $1 AND t.status IN ('resolu', 'cloture') AND t.resolved_at >= $2) as resolved_recent`,
      [id, startDate]
    );

    // Tickets par jour
    const { rows: ticketsByDay } = await query(
      `SELECT DATE(t.created_at) as date, COUNT(*) as count
       FROM tickets t
       JOIN agencies a ON t.agency_id = a.id
       WHERE a.company_id = $1 AND t.created_at >= $2
       GROUP BY DATE(t.created_at)
       ORDER BY date`,
      [id, startDate]
    );

    // Tickets par agence
    const { rows: ticketsBySite } = await query(
      `SELECT a.name, COUNT(t.id) as count
       FROM agencies a
       LEFT JOIN tickets t ON t.agency_id = a.id AND t.created_at >= $2
       WHERE a.company_id = $1
       GROUP BY a.id, a.name
       ORDER BY count DESC`,
      [id, startDate]
    );

    res.json({
      general: generalStats[0],
      ticketsByDay,
      ticketsBySite,
      period: periodDays
    });
  } catch (err) {
    console.error('Erreur stats company:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

module.exports = router;
