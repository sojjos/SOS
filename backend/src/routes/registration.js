const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// ====================================
// POST /api/register/validate-code - Valider un code d'invitation
// ====================================
router.post('/validate-code', [
  body('code').trim().notEmpty().withMessage('Code requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;

    const { rows } = await query(
      `SELECT
        ic.*,
        c.name as company_name,
        c.slug as company_slug,
        c.subscription_plan,
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
      codeType: invitation.code_type,
      companyId: invitation.company_id,
      companyName: invitation.company_name,
      companySlug: invitation.company_slug,
      targetAgencyId: invitation.target_agency_id,
      targetAgencyName: invitation.target_agency_name,
      targetRole: invitation.target_role,
      targetLevel: invitation.target_level,
      targetProfileTypes: invitation.target_profile_types,
      remainingUses: invitation.max_uses - invitation.current_uses
    });
  } catch (err) {
    console.error('Erreur validation code:', err);
    res.status(500).json({ valid: false, error: 'Erreur lors de la validation' });
  }
});

// ====================================
// POST /api/register/company - Créer une entreprise avec code d'invitation
// ====================================
router.post('/company', [
  body('code').trim().notEmpty().withMessage('Code d\'invitation requis'),
  body('companyName').trim().notEmpty().withMessage('Nom de l\'entreprise requis'),
  body('companySlug').trim().matches(/^[a-z0-9-]+$/).withMessage('Slug invalide'),
  body('adminEmail').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Mot de passe min. 8 caractères'),
  body('adminFirstName').trim().notEmpty().withMessage('Prénom requis'),
  body('adminLastName').trim().notEmpty().withMessage('Nom requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      code,
      companyName,
      companySlug,
      companyAddress,
      companyCity,
      companyCountry,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      adminPhone
    } = req.body;

    // Valider le code
    const { rows: invitations } = await query(
      `SELECT * FROM invitation_codes WHERE code = $1 AND code_type = 'company_registration'`,
      [code.toUpperCase()]
    );

    if (invitations.length === 0) {
      return res.status(400).json({ error: 'Code d\'invitation invalide' });
    }

    const invitation = invitations[0];

    if (!invitation.is_active) {
      return res.status(400).json({ error: 'Code désactivé' });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code expiré' });
    }

    if (invitation.current_uses >= invitation.max_uses) {
      return res.status(400).json({ error: 'Code épuisé' });
    }

    // Vérifier l'unicité du slug
    const { rows: existingSlug } = await query(
      'SELECT id FROM companies WHERE slug = $1',
      [companySlug]
    );

    if (existingSlug.length > 0) {
      return res.status(400).json({ error: 'Ce slug est déjà utilisé' });
    }

    // Vérifier l'unicité de l'email admin
    const { rows: existingEmail } = await query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail.toLowerCase()]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Calculer la date de fin d'essai (30 jours)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);

    // Créer l'entreprise
    const { rows: companies } = await query(
      `INSERT INTO companies (
        name, slug, contact_email, contact_name, address, city, country,
        subscription_plan, subscription_status, trial_ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'starter', 'trial', $8)
      RETURNING *`,
      [
        companyName,
        companySlug,
        adminEmail.toLowerCase(),
        `${adminFirstName} ${adminLastName}`,
        companyAddress || null,
        companyCity || null,
        companyCountry || 'Belgique',
        trialEndsAt
      ]
    );

    const company = companies[0];

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Créer l'utilisateur admin
    const { rows: users } = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone,
        account_type, account_status, is_active, company_id, invited_by_code
      ) VALUES ($1, $2, $3, $4, $5, 'admin', 'active', true, $6, $7)
      RETURNING id, email, first_name, last_name, account_type`,
      [
        adminEmail.toLowerCase(),
        passwordHash,
        adminFirstName,
        adminLastName,
        adminPhone || null,
        company.id,
        code.toUpperCase()
      ]
    );

    const user = users[0];

    // Mettre à jour le compteur du code d'invitation
    await query(
      'UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = $1',
      [invitation.id]
    );

    // Mettre à jour les compteurs de l'entreprise
    await query(
      'UPDATE companies SET current_users_count = 1, current_admins_count = 1 WHERE id = $1',
      [company.id]
    );

    // Générer le token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        accountType: user.account_type
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Entreprise créée avec succès',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        accountType: user.account_type,
        isAdmin: true
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        subscriptionPlan: company.subscription_plan,
        subscriptionStatus: company.subscription_status,
        trialEndsAt: company.trial_ends_at
      }
    });
  } catch (err) {
    console.error('Erreur création entreprise:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'entreprise' });
  }
});

// ====================================
// POST /api/register/user - Inscription utilisateur avec code d'invitation
// ====================================
router.post('/user', [
  body('code').trim().notEmpty().withMessage('Code d\'invitation requis'),
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe min. 8 caractères'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code, email, password, firstName, lastName, phone } = req.body;

    // Valider le code
    const { rows: invitations } = await query(
      `SELECT ic.*, c.max_users, c.current_users_count, c.max_admins, c.current_admins_count
       FROM invitation_codes ic
       JOIN companies c ON ic.company_id = c.id
       WHERE ic.code = $1 AND ic.code_type IN ('user_invite', 'admin_invite')`,
      [code.toUpperCase()]
    );

    if (invitations.length === 0) {
      return res.status(400).json({ error: 'Code d\'invitation invalide' });
    }

    const invitation = invitations[0];

    // Validations du code
    if (!invitation.is_active) {
      return res.status(400).json({ error: 'Code désactivé' });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code expiré' });
    }

    if (invitation.current_uses >= invitation.max_uses) {
      return res.status(400).json({ error: 'Code épuisé' });
    }

    // Vérifier les quotas de l'entreprise
    const isAdminInvite = invitation.code_type === 'admin_invite';

    if (invitation.current_users_count >= invitation.max_users) {
      return res.status(400).json({ error: 'L\'entreprise a atteint son quota d\'utilisateurs' });
    }

    if (isAdminInvite && invitation.current_admins_count >= invitation.max_admins) {
      return res.status(400).json({ error: 'L\'entreprise a atteint son quota d\'administrateurs' });
    }

    // Vérifier l'unicité de l'email
    const { rows: existingEmail } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    // Déterminer le type de compte
    const accountType = isAdminInvite ? 'admin_delegated' : 'user';

    // Créer l'utilisateur
    const { rows: users } = await query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, phone,
        account_type, account_status, is_active, company_id, invited_by_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', true, $7, $8)
      RETURNING id, email, first_name, last_name, account_type`,
      [
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone || null,
        accountType,
        invitation.company_id,
        code.toUpperCase()
      ]
    );

    const user = users[0];

    // Si une agence cible est spécifiée, créer l'accès
    if (invitation.target_agency_id) {
      // Trouver le hierarchy_level_id si un niveau est spécifié
      let hierarchyLevelId = null;
      if (invitation.target_level !== null) {
        const { rows: levels } = await query(
          'SELECT id FROM hierarchy_levels WHERE agency_id = $1 AND level_number = $2',
          [invitation.target_agency_id, invitation.target_level]
        );
        if (levels.length > 0) {
          hierarchyLevelId = levels[0].id;
        }
      }

      await query(
        `INSERT INTO user_agency_access (
          user_id, agency_id, hierarchy_level_id, access_type, profile_types, is_active
        ) VALUES ($1, $2, $3, 'full', $4, true)`,
        [
          user.id,
          invitation.target_agency_id,
          hierarchyLevelId,
          JSON.stringify(invitation.target_profile_types || ['terrain'])
        ]
      );
    }

    // Mettre à jour le compteur du code d'invitation
    await query(
      'UPDATE invitation_codes SET current_uses = current_uses + 1 WHERE id = $1',
      [invitation.id]
    );

    // Générer le token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        accountType: user.account_type
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Charger les accès aux agences
    const { rows: agencyAccesses } = await query(
      `SELECT uaa.*, a.name as agency_name, a.code as agency_code,
              hl.level_number, hl.name as level_name
       FROM user_agency_access uaa
       JOIN agencies a ON uaa.agency_id = a.id
       LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
       WHERE uaa.user_id = $1 AND uaa.is_active = true`,
      [user.id]
    );

    res.status(201).json({
      message: 'Compte créé avec succès',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        accountType: user.account_type,
        isAdmin: accountType === 'admin' || accountType === 'admin_delegated',
        agencyAccesses
      }
    });
  } catch (err) {
    console.error('Erreur création utilisateur:', err);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

module.exports = router;
