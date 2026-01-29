const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const { authenticatePlatformAdmin } = require('./auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Tous les endpoints nécessitent une authentification platform admin
router.use(authenticatePlatformAdmin);

// ====================================
// GET /api/platform/invitations - Liste des codes d'invitation
// ====================================
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      companyId,
      codeType,
      isActive,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (companyId) {
      params.push(companyId);
      whereClause += ` AND ic.company_id = $${params.length}`;
    }

    if (codeType) {
      params.push(codeType);
      whereClause += ` AND ic.code_type = $${params.length}`;
    }

    if (isActive !== undefined) {
      params.push(isActive === 'true');
      whereClause += ` AND ic.is_active = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (ic.code ILIKE $${params.length} OR ic.notes ILIKE $${params.length})`;
    }

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM invitation_codes ic ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Fetch invitations
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT
        ic.*,
        c.name as company_name,
        c.slug as company_slug,
        a.name as target_agency_name,
        pa.email as created_by_platform_email,
        u.email as created_by_company_email
      FROM invitation_codes ic
      LEFT JOIN companies c ON ic.company_id = c.id
      LEFT JOIN agencies a ON ic.target_agency_id = a.id
      LEFT JOIN platform_admins pa ON ic.created_by_platform_admin = pa.id
      LEFT JOIN users u ON ic.created_by_company_admin = u.id
      ${whereClause}
      ORDER BY ic.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      invitations: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Erreur liste invitations:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des invitations' });
  }
});

// ====================================
// POST /api/platform/invitations - Créer un code d'invitation
// ====================================
router.post('/', [
  body('codeType').isIn(['company_registration', 'user_invite', 'admin_invite']).withMessage('Type de code invalide'),
  body('companyId').optional().isUUID().withMessage('ID entreprise invalide'),
  body('maxUses').optional().isInt({ min: 1 }).withMessage('Nombre d\'utilisations invalide'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('Durée de validité invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      codeType,
      companyId,
      targetAgencyId,
      targetRole,
      targetLevel,
      targetProfileTypes = ['terrain'],
      maxUses = 1,
      expiresInDays = 7,
      notes,
      customCode
    } = req.body;

    // Valider selon le type de code
    if (codeType !== 'company_registration' && !companyId) {
      return res.status(400).json({ error: 'ID entreprise requis pour ce type de code' });
    }

    // Vérifier que l'entreprise existe si fournie
    if (companyId) {
      const { rows: company } = await query(
        'SELECT id FROM companies WHERE id = $1 AND is_active = true',
        [companyId]
      );
      if (company.length === 0) {
        return res.status(400).json({ error: 'Entreprise non trouvée ou inactive' });
      }
    }

    // Générer le code
    let code;
    if (customCode) {
      // Vérifier l'unicité du code personnalisé
      const { rows: existingCode } = await query(
        'SELECT id FROM invitation_codes WHERE code = $1',
        [customCode.toUpperCase()]
      );
      if (existingCode.length > 0) {
        return res.status(400).json({ error: 'Ce code existe déjà' });
      }
      code = customCode.toUpperCase();
    } else {
      const prefix = codeType === 'company_registration' ? 'REG' :
                     codeType === 'admin_invite' ? 'ADM' : 'USR';
      code = `${prefix}-${uuidv4().substring(0, 8).toUpperCase()}`;
    }

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Créer le code
    const { rows } = await query(
      `INSERT INTO invitation_codes (
        company_id, code, code_type, target_agency_id, target_role, target_level,
        target_profile_types, max_uses, expires_at, created_by_platform_admin, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        companyId || null,
        code,
        codeType,
        targetAgencyId || null,
        targetRole || null,
        targetLevel || null,
        JSON.stringify(targetProfileTypes),
        maxUses,
        expiresAt,
        req.platformAdmin.id,
        notes || null
      ]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'invitation_created', 'invitation_code', $3, $4, $5)`,
      [
        req.platformAdmin.id,
        companyId || null,
        rows[0].id,
        JSON.stringify({ code, codeType, maxUses }),
        req.ip
      ]
    );

    res.status(201).json({
      invitation: rows[0],
      message: 'Code d\'invitation créé avec succès'
    });
  } catch (err) {
    console.error('Erreur création invitation:', err);
    res.status(500).json({ error: 'Erreur lors de la création du code d\'invitation' });
  }
});

// ====================================
// POST /api/platform/invitations/batch - Créer plusieurs codes
// ====================================
router.post('/batch', [
  body('codeType').isIn(['company_registration', 'user_invite', 'admin_invite']),
  body('count').isInt({ min: 1, max: 100 }).withMessage('Nombre de codes entre 1 et 100'),
  body('companyId').optional().isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      codeType,
      companyId,
      count,
      maxUsesPerCode = 1,
      expiresInDays = 7,
      targetAgencyId,
      targetLevel,
      notes
    } = req.body;

    if (codeType !== 'company_registration' && !companyId) {
      return res.status(400).json({ error: 'ID entreprise requis pour ce type de code' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const prefix = codeType === 'company_registration' ? 'REG' :
                   codeType === 'admin_invite' ? 'ADM' : 'USR';

    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = `${prefix}-${uuidv4().substring(0, 8).toUpperCase()}`;
      codes.push(code);

      await query(
        `INSERT INTO invitation_codes (
          company_id, code, code_type, target_agency_id, target_level,
          max_uses, expires_at, created_by_platform_admin, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          companyId || null,
          code,
          codeType,
          targetAgencyId || null,
          targetLevel || null,
          maxUsesPerCode,
          expiresAt,
          req.platformAdmin.id,
          notes || `Batch ${new Date().toISOString()}`
        ]
      );
    }

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, company_id, action, details, ip_address)
       VALUES ($1, $2, 'batch_invitations_created', $3, $4)`,
      [
        req.platformAdmin.id,
        companyId || null,
        JSON.stringify({ count, codeType, codes }),
        req.ip
      ]
    );

    res.status(201).json({
      codes,
      count,
      message: `${count} codes d'invitation créés avec succès`
    });
  } catch (err) {
    console.error('Erreur création batch invitations:', err);
    res.status(500).json({ error: 'Erreur lors de la création des codes' });
  }
});

// ====================================
// PUT /api/platform/invitations/:id - Modifier un code
// ====================================
router.put('/:id', [
  body('isActive').optional().isBoolean(),
  body('maxUses').optional().isInt({ min: 1 }),
  body('expiresAt').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { isActive, maxUses, expiresAt, notes } = req.body;

    const { rows: existing } = await query(
      'SELECT * FROM invitation_codes WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Code d\'invitation non trouvé' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    if (maxUses !== undefined) {
      updates.push(`max_uses = $${paramIndex++}`);
      values.push(maxUses);
    }
    if (expiresAt !== undefined) {
      updates.push(`expires_at = $${paramIndex++}`);
      values.push(expiresAt);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    values.push(id);
    const { rows } = await query(
      `UPDATE invitation_codes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({
      invitation: rows[0],
      message: 'Code d\'invitation modifié avec succès'
    });
  } catch (err) {
    console.error('Erreur modification invitation:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du code' });
  }
});

// ====================================
// DELETE /api/platform/invitations/:id - Supprimer/Désactiver un code
// ====================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: existing } = await query(
      'SELECT * FROM invitation_codes WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Code d\'invitation non trouvé' });
    }

    // Si déjà utilisé, on désactive seulement
    if (existing[0].current_uses > 0) {
      await query(
        'UPDATE invitation_codes SET is_active = false WHERE id = $1',
        [id]
      );
      return res.json({ message: 'Code désactivé (déjà utilisé)' });
    }

    // Sinon on supprime
    await query('DELETE FROM invitation_codes WHERE id = $1', [id]);

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, company_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, 'invitation_deleted', 'invitation_code', $3, $4, $5)`,
      [
        req.platformAdmin.id,
        existing[0].company_id,
        id,
        JSON.stringify({ code: existing[0].code }),
        req.ip
      ]
    );

    res.json({ message: 'Code d\'invitation supprimé' });
  } catch (err) {
    console.error('Erreur suppression invitation:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du code' });
  }
});

// ====================================
// GET /api/platform/invitations/validate/:code - Valider un code (public)
// ====================================
// Note: Cette route est accessible publiquement pour la validation côté frontend
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const { rows } = await query(
      `SELECT
        ic.*,
        c.name as company_name,
        c.slug as company_slug,
        a.name as target_agency_name
      FROM invitation_codes ic
      LEFT JOIN companies c ON ic.company_id = c.id
      LEFT JOIN agencies a ON ic.target_agency_id = a.id
      WHERE ic.code = $1`,
      [code.toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Code non trouvé' });
    }

    const invitation = rows[0];

    // Vérifications
    if (!invitation.is_active) {
      return res.json({ valid: false, error: 'Code désactivé' });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.json({ valid: false, error: 'Code expiré' });
    }

    if (invitation.current_uses >= invitation.max_uses) {
      return res.json({ valid: false, error: 'Code épuisé' });
    }

    // Code valide
    res.json({
      valid: true,
      invitation: {
        codeType: invitation.code_type,
        companyId: invitation.company_id,
        companyName: invitation.company_name,
        companySlug: invitation.company_slug,
        targetAgencyId: invitation.target_agency_id,
        targetAgencyName: invitation.target_agency_name,
        targetRole: invitation.target_role,
        targetLevel: invitation.target_level,
        targetProfileTypes: invitation.target_profile_types,
        remainingUses: invitation.max_uses - invitation.current_uses,
        expiresAt: invitation.expires_at
      }
    });
  } catch (err) {
    console.error('Erreur validation invitation:', err);
    res.status(500).json({ valid: false, error: 'Erreur lors de la validation' });
  }
});

module.exports = router;
