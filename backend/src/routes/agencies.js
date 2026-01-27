const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin, requireAgencyAccess } = require('../middlewares/auth');

const router = express.Router();

// ====================================
// GET /api/agencies/public - Liste publique des agences (pour demande de compte)
// ====================================
router.get('/public', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, city FROM agencies WHERE is_active = true ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste agences publique:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des agences' });
  }
});

// ====================================
// GET /api/agencies - Liste des agences
// ====================================
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;

    let agenciesQuery;
    let params = [];

    if (user.account_type === 'admin' || user.account_type === 'admin_delegated') {
      // Admin voit toutes les agences
      agenciesQuery = 'SELECT * FROM agencies ORDER BY name';
    } else {
      // Utilisateur voit seulement ses agences
      const agencyIds = user.agency_accesses?.map(a => a.agency_id) || [];
      if (agencyIds.length === 0) {
        return res.json([]);
      }
      agenciesQuery = 'SELECT * FROM agencies WHERE id = ANY($1) AND is_active = true ORDER BY name';
      params = [agencyIds];
    }

    const { rows } = await query(agenciesQuery, params);
    res.json(rows);
  } catch (err) {
    console.error('Erreur liste agences:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des agences' });
  }
});

// ====================================
// GET /api/agencies/:id - Détail agence
// ====================================
router.get('/:id', authenticate, requireAgencyAccess('id'), async (req, res) => {
  try {
    const agency = req.agency;

    // Charger les niveaux hiérarchiques
    const { rows: levels } = await query(
      'SELECT * FROM hierarchy_levels WHERE agency_id = $1 ORDER BY level_number',
      [agency.id]
    );
    agency.hierarchy_levels = levels;

    // Charger les lieux
    const { rows: locations } = await query(
      'SELECT * FROM locations WHERE agency_id = $1 AND is_active = true ORDER BY name',
      [agency.id]
    );
    agency.locations = locations;

    // Charger les types de problèmes
    const { rows: problemTypes } = await query(
      'SELECT * FROM problem_types WHERE agency_id = $1 AND is_active = true ORDER BY name',
      [agency.id]
    );
    agency.problem_types = problemTypes;

    // Charger les SLA
    const { rows: slaConfigs } = await query(
      'SELECT * FROM sla_configs WHERE agency_id = $1',
      [agency.id]
    );
    agency.sla_configs = slaConfigs;

    // Stats rapides
    const { rows: stats } = await query(`
      SELECT
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status NOT IN ('resolu', 'cloture') THEN 1 END) as open_tickets,
        COUNT(CASE WHEN validated_urgency = 'critique' AND status NOT IN ('resolu', 'cloture') THEN 1 END) as critical_tickets
      FROM tickets
      WHERE agency_id = $1
    `, [agency.id]);
    agency.stats = stats[0];

    res.json(agency);
  } catch (err) {
    console.error('Erreur détail agence:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'agence' });
  }
});

// ====================================
// POST /api/agencies - Créer agence (Admin)
// ====================================
router.post('/', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Nom requis'),
  body('code').trim().notEmpty().withMessage('Code requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, code, address, city, country, copyFromAgencyId } = req.body;

    // Vérifier unicité
    const { rows: existing } = await query(
      'SELECT id FROM agencies WHERE code = $1 OR name = $2',
      [code.toUpperCase(), name]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Une agence avec ce code ou nom existe déjà' });
    }

    // Créer l'agence
    const { rows } = await query(`
      INSERT INTO agencies (name, code, address, city, country)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, code.toUpperCase(), address || null, city || null, country || 'Belgique']);

    const newAgency = rows[0];

    // Si copie depuis une autre agence
    if (copyFromAgencyId) {
      // Copier les niveaux hiérarchiques
      await query(`
        INSERT INTO hierarchy_levels (agency_id, level_number, name, description, permissions, escalates_to_level)
        SELECT $1, level_number, name, description, permissions, escalates_to_level
        FROM hierarchy_levels WHERE agency_id = $2
      `, [newAgency.id, copyFromAgencyId]);

      // Copier les types de problèmes
      await query(`
        INSERT INTO problem_types (agency_id, name, description, color, icon, min_level_required)
        SELECT $1, name, description, color, icon, min_level_required
        FROM problem_types WHERE agency_id = $2
      `, [newAgency.id, copyFromAgencyId]);

      // Copier les SLA
      await query(`
        INSERT INTO sla_configs (agency_id, urgency, blocking_level, response_time_hours, resolution_time_hours)
        SELECT $1, urgency, blocking_level, response_time_hours, resolution_time_hours
        FROM sla_configs WHERE agency_id = $2
      `, [newAgency.id, copyFromAgencyId]);
    }

    // Log
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, 'agency_created', 'agency', $2, $3, $4)
    `, [req.user.id, newAgency.id, JSON.stringify({ name, code, copyFromAgencyId }), req.ip]);

    res.status(201).json(newAgency);
  } catch (err) {
    console.error('Erreur création agence:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'agence' });
  }
});

// ====================================
// PUT /api/agencies/:id - Modifier agence
// ====================================
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, country, isActive, config } = req.body;

    await query(`
      UPDATE agencies SET
        name = COALESCE($1, name),
        address = COALESCE($2, address),
        city = COALESCE($3, city),
        country = COALESCE($4, country),
        is_active = COALESCE($5, is_active),
        config = COALESCE($6, config),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
    `, [name, address, city, country, isActive, config ? JSON.stringify(config) : null, id]);

    // Log
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, 'agency_updated', 'agency', $2, $3, $4)
    `, [req.user.id, id, JSON.stringify(req.body), req.ip]);

    const { rows } = await query('SELECT * FROM agencies WHERE id = $1', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification agence:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'agence' });
  }
});

// ====================================
// GESTION DES TYPES DE PROBLEMES
// ====================================

// GET /api/agencies/:id/problem-types
router.get('/:id/problem-types', authenticate, requireAgencyAccess('id'), async (req, res) => {
  try {
    const user = req.user;
    const agencyId = req.params.id;

    // Determiner le niveau de l'utilisateur pour cette agence
    let userLevel = 999; // Admin par defaut
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const userAccess = user.agency_accesses?.find(a => a.agency_id === agencyId);
      userLevel = userAccess?.level_number ?? 0;
    }

    // Filtrer selon le niveau de l'utilisateur
    const { rows } = await query(
      `SELECT * FROM problem_types
       WHERE agency_id = $1
       AND is_active = true
       AND min_level_required <= $2
       ORDER BY name`,
      [agencyId, userLevel]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur liste types de problemes:', err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/agencies/:id/problem-types
router.post('/:id/problem-types', authenticate, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Nom requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, color, icon, min_level_required } = req.body;
    const { rows } = await query(`
      INSERT INTO problem_types (agency_id, name, description, color, icon, min_level_required)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [req.params.id, name, description || null, color || '#6c757d', icon || null, min_level_required || 0]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur creation type:', err);
    res.status(500).json({ error: 'Erreur creation type de probleme' });
  }
});

// PUT /api/agencies/:agencyId/problem-types/:typeId
router.put('/:agencyId/problem-types/:typeId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { typeId } = req.params;
    const { name, description, color, icon, is_active, min_level_required } = req.body;

    await query(`
      UPDATE problem_types SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        color = COALESCE($3, color),
        icon = COALESCE($4, icon),
        is_active = COALESCE($5, is_active),
        min_level_required = COALESCE($6, min_level_required)
      WHERE id = $7
    `, [name, description, color, icon, is_active, min_level_required, typeId]);

    const { rows } = await query('SELECT * FROM problem_types WHERE id = $1', [typeId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification type:', err);
    res.status(500).json({ error: 'Erreur modification type de probleme' });
  }
});

// ====================================
// GESTION DES LIEUX
// ====================================

// GET /api/agencies/:id/locations
router.get('/:id/locations', authenticate, requireAgencyAccess('id'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM locations WHERE agency_id = $1 ORDER BY location_type, name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/agencies/:id/locations
router.post('/:id/locations', authenticate, requireAdmin, [
  body('name').trim().notEmpty(),
  body('location_type').isIn(['terrain', 'administratif', 'commun', 'exterieur'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, location_type, description } = req.body;
    const { rows } = await query(`
      INSERT INTO locations (agency_id, name, location_type, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, name, location_type, description || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur création lieu' });
  }
});

// ====================================
// GESTION DES NIVEAUX HIÉRARCHIQUES
// ====================================

// GET /api/agencies/:id/levels
router.get('/:id/levels', authenticate, requireAgencyAccess('id'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM hierarchy_levels WHERE agency_id = $1 ORDER BY level_number',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/agencies/:id/levels
router.post('/:id/levels', authenticate, requireAdmin, [
  body('level_number').isInt({ min: 0 }),
  body('name').trim().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { level_number, name, description, permissions, escalates_to_level } = req.body;
    const { rows } = await query(`
      INSERT INTO hierarchy_levels (agency_id, level_number, name, description, permissions, escalates_to_level)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.params.id,
      level_number,
      name,
      description || null,
      permissions ? JSON.stringify(permissions) : '{}',
      escalates_to_level
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur création niveau' });
  }
});

// PUT /api/agencies/:agencyId/levels/:levelId
router.put('/:agencyId/levels/:levelId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { levelId } = req.params;
    const { name, description, permissions, escalates_to_level } = req.body;

    await query(`
      UPDATE hierarchy_levels SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        permissions = COALESCE($3, permissions),
        escalates_to_level = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [name, description, permissions ? JSON.stringify(permissions) : null, escalates_to_level, levelId]);

    const { rows } = await query('SELECT * FROM hierarchy_levels WHERE id = $1', [levelId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur modification niveau' });
  }
});

// ====================================
// GESTION DES SLA
// ====================================

// GET /api/agencies/:id/sla
router.get('/:id/sla', authenticate, requireAgencyAccess('id'), async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM sla_configs WHERE agency_id = $1 ORDER BY urgency, blocking_level',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
});

// PUT /api/agencies/:id/sla
router.put('/:id/sla', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slaConfigs } = req.body;
    const agencyId = req.params.id;

    for (const config of slaConfigs) {
      await query(`
        INSERT INTO sla_configs (agency_id, urgency, blocking_level, response_time_hours, resolution_time_hours)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (agency_id, urgency, blocking_level)
        DO UPDATE SET
          response_time_hours = EXCLUDED.response_time_hours,
          resolution_time_hours = EXCLUDED.resolution_time_hours,
          updated_at = CURRENT_TIMESTAMP
      `, [agencyId, config.urgency, config.blocking_level, config.response_time_hours, config.resolution_time_hours]);
    }

    const { rows } = await query('SELECT * FROM sla_configs WHERE agency_id = $1', [agencyId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur mise à jour SLA' });
  }
});

module.exports = router;
