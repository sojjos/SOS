const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
require('dotenv').config();

async function seedPlatformAdmin() {
  console.log('🔐 Création de l\'administrateur plateforme...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Configuration
    const platformEmail = process.env.DEFAULT_PLATFORM_ADMIN_EMAIL || 'platform@sos.local';
    const platformPassword = process.env.DEFAULT_PLATFORM_ADMIN_PASSWORD || 'PlatformAdmin123!';
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;

    // Vérifier si l'admin existe déjà
    const { rows: existingAdmin } = await client.query(
      'SELECT id FROM platform_admins WHERE email = $1',
      [platformEmail]
    );

    if (existingAdmin.length > 0) {
      console.log(`⏭️  Admin plateforme existe déjà: ${platformEmail}`);
      await client.query('COMMIT');
      return;
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(platformPassword, bcryptRounds);

    // Créer l'admin plateforme (super_admin)
    await client.query(`
      INSERT INTO platform_admins (email, password_hash, first_name, last_name, role, is_active)
      VALUES ($1, $2, 'Platform', 'Admin', 'super_admin', true)
    `, [platformEmail, passwordHash]);

    console.log(`✅ Admin plateforme créé: ${platformEmail}`);
    console.log(`   Rôle: super_admin`);

    // Créer aussi un admin viewer pour les tests (optionnel)
    const viewerEmail = 'viewer@sos.local';
    const viewerPassword = 'ViewerAdmin123!';
    const { rows: existingViewer } = await client.query(
      'SELECT id FROM platform_admins WHERE email = $1',
      [viewerEmail]
    );

    if (existingViewer.length === 0 && process.env.CREATE_VIEWER_ADMIN === 'true') {
      const viewerHash = await bcrypt.hash(viewerPassword, bcryptRounds);
      await client.query(`
        INSERT INTO platform_admins (email, password_hash, first_name, last_name, role, is_active)
        VALUES ($1, $2, 'Platform', 'Viewer', 'viewer', true)
      `, [viewerEmail, viewerHash]);
      console.log(`✅ Admin viewer créé: ${viewerEmail}`);
    }

    // Créer un code d'invitation initial pour permettre l'enregistrement de la première entreprise
    const invitationCode = 'REG-INITIAL-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    const { rows: existingCodes } = await client.query(
      "SELECT id FROM invitation_codes WHERE code_type = 'company_registration' AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())"
    );

    if (existingCodes.length === 0) {
      await client.query(`
        INSERT INTO invitation_codes (code, code_type, max_uses, current_uses, is_active, created_by_admin_id)
        SELECT $1, 'company_registration', 10, 0, true, id
        FROM platform_admins WHERE email = $2
        LIMIT 1
      `, [invitationCode, platformEmail]);

      console.log(`\n📋 Code d'invitation initial créé: ${invitationCode}`);
      console.log(`   Type: Enregistrement entreprise`);
      console.log(`   Utilisations max: 10`);
    }

    await client.query('COMMIT');

    console.log('\n' + '='.repeat(60));
    console.log('📋 IDENTIFIANTS ADMIN PLATEFORME:');
    console.log('='.repeat(60));
    console.log(`Email:        ${platformEmail}`);
    console.log(`Mot de passe: ${platformPassword}`);
    console.log(`URL:          /platform/login`);
    console.log('='.repeat(60));
    console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    console.log('='.repeat(60) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Exécution directe ou export
if (require.main === module) {
  seedPlatformAdmin()
    .then(() => {
      console.log('🎉 Seeding admin plateforme terminé!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Erreur:', err);
      process.exit(1);
    });
} else {
  module.exports = seedPlatformAdmin;
}
