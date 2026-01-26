const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
require('dotenv').config();

async function seedInitialData() {
  console.log('🌱 Insertion des données initiales...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Créer l'administrateur par défaut
    console.log('👤 Création de l\'administrateur par défaut...');
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@sos.local';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMeOnFirstLogin!';
    const passwordHash = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const { rows: existingAdmin } = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );

    let adminId;
    if (existingAdmin.length === 0) {
      const { rows: adminRows } = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, account_type, is_active, is_email_verified)
        VALUES ($1, $2, 'Admin', 'System', 'admin', true, true)
        RETURNING id
      `, [adminEmail, passwordHash]);
      adminId = adminRows[0].id;
      console.log(`✅ Administrateur créé: ${adminEmail}`);
    } else {
      adminId = existingAdmin[0].id;
      console.log(`⏭️  Administrateur existe déjà: ${adminEmail}`);
    }

    // 2. Créer une agence de démonstration
    console.log('\n🏢 Création de l\'agence de démonstration...');
    const { rows: existingAgency } = await client.query(
      'SELECT id FROM agencies WHERE code = $1',
      ['DEMO']
    );

    let agencyId;
    if (existingAgency.length === 0) {
      const { rows: agencyRows } = await client.query(`
        INSERT INTO agencies (name, code, address, city, country, is_active, config)
        VALUES ('Agence Démonstration', 'DEMO', '123 Rue Example', 'Bruxelles', 'Belgique', true, '{}')
        RETURNING id
      `);
      agencyId = agencyRows[0].id;
      console.log('✅ Agence de démonstration créée');

      // 3. Créer les niveaux hiérarchiques par défaut
      console.log('\n📊 Création des niveaux hiérarchiques...');
      const levels = [
        {
          level_number: 0,
          name: 'Opérateur',
          description: 'Personnel terrain',
          permissions: JSON.stringify({
            can_create_tickets: true,
            can_see_own_tickets: true,
            can_see_team_tickets: false,
            can_validate_tickets: false,
            can_close_tickets: false,
            can_access_dashboard_personal: true,
            can_access_dashboard_team: false,
            can_access_dashboard_site: false,
            can_export: false,
            screenshot_protection: true
          })
        },
        {
          level_number: 1,
          name: 'Chef d\'équipe',
          description: 'Encadrement de proximité',
          permissions: JSON.stringify({
            can_create_tickets: true,
            can_see_own_tickets: true,
            can_see_team_tickets: true,
            can_validate_tickets: true,
            can_close_tickets: true,
            can_access_dashboard_personal: true,
            can_access_dashboard_team: true,
            can_access_dashboard_site: false,
            can_export: false,
            screenshot_protection: true
          })
        },
        {
          level_number: 2,
          name: 'Responsable',
          description: 'Direction opérationnelle',
          permissions: JSON.stringify({
            can_create_tickets: true,
            can_see_own_tickets: true,
            can_see_team_tickets: true,
            can_see_all_site_tickets: true,
            can_validate_tickets: true,
            can_close_tickets: true,
            can_mark_visible_union: true,
            can_access_dashboard_personal: true,
            can_access_dashboard_team: true,
            can_access_dashboard_site: true,
            can_access_dashboard_direction: true,
            can_export: false,
            screenshot_protection: true
          })
        },
        {
          level_number: 3,
          name: 'Direction',
          description: 'Direction du site',
          permissions: JSON.stringify({
            can_create_tickets: true,
            can_see_all_site_tickets: true,
            can_validate_tickets: true,
            can_close_tickets: true,
            can_mark_visible_union: true,
            can_modify_tickets: true,
            can_access_all_dashboards: true,
            can_export: true,
            screenshot_protection: false
          })
        }
      ];

      for (const level of levels) {
        await client.query(`
          INSERT INTO hierarchy_levels (agency_id, level_number, name, description, permissions, escalates_to_level)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          agencyId,
          level.level_number,
          level.name,
          level.description,
          level.permissions,
          level.level_number < 3 ? level.level_number + 1 : null
        ]);
        console.log(`  ✅ Niveau ${level.level_number}: ${level.name}`);
      }

      // 4. Créer les types de problèmes par défaut
      console.log('\n📁 Création des types de problèmes...');
      const problemTypes = [
        { name: 'Équipement', description: 'Problèmes liés aux équipements et machines', color: '#dc3545', icon: '🔧' },
        { name: 'Qualité', description: 'Problèmes de qualité produit ou process', color: '#ffc107', icon: '⭐' },
        { name: 'Sécurité', description: 'Problèmes de sécurité des personnes ou biens', color: '#ff5722', icon: '⚠️' },
        { name: 'Process', description: 'Problèmes de processus ou organisation', color: '#2196f3', icon: '📋' },
        { name: 'RH', description: 'Problèmes liés aux ressources humaines', color: '#9c27b0', icon: '👥' },
        { name: 'Informatique', description: 'Problèmes informatiques et systèmes', color: '#607d8b', icon: '💻' },
        { name: 'Autre', description: 'Autres types de problèmes', color: '#6c757d', icon: '📌' }
      ];

      for (const pt of problemTypes) {
        await client.query(`
          INSERT INTO problem_types (agency_id, name, description, color, icon)
          VALUES ($1, $2, $3, $4, $5)
        `, [agencyId, pt.name, pt.description, pt.color, pt.icon]);
        console.log(`  ✅ Type: ${pt.name}`);
      }

      // 5. Créer les lieux par défaut
      console.log('\n📍 Création des lieux...');
      const locations = [
        { name: 'Quai 1', type: 'terrain' },
        { name: 'Quai 2', type: 'terrain' },
        { name: 'Entrepôt Frais Zone A', type: 'terrain' },
        { name: 'Entrepôt Frais Zone B', type: 'terrain' },
        { name: 'Entrepôt Sec', type: 'terrain' },
        { name: 'Chambre froide -25°', type: 'terrain' },
        { name: 'Chambre froide -18°', type: 'terrain' },
        { name: 'Zone de préparation', type: 'terrain' },
        { name: 'Bureau Direction', type: 'administratif' },
        { name: 'Bureau RH', type: 'administratif' },
        { name: 'Salle de réunion', type: 'administratif' },
        { name: 'Vestiaires', type: 'commun' },
        { name: 'Salle de pause', type: 'commun' },
        { name: 'Parking PL', type: 'exterieur' },
        { name: 'Parking VL', type: 'exterieur' }
      ];

      for (const loc of locations) {
        await client.query(`
          INSERT INTO locations (agency_id, name, location_type)
          VALUES ($1, $2, $3)
        `, [agencyId, loc.name, loc.type]);
        console.log(`  ✅ Lieu: ${loc.name}`);
      }

      // 6. Créer les configurations SLA par défaut
      console.log('\n⏱️ Création des configurations SLA...');
      const slaConfigs = [
        { urgency: 'critique', blocking: 'bloquant', response: 2, resolution: 24 },
        { urgency: 'critique', blocking: 'partiel', response: 4, resolution: 24 },
        { urgency: 'critique', blocking: 'non_bloquant', response: 4, resolution: 48 },
        { urgency: 'haute', blocking: 'bloquant', response: 4, resolution: 48 },
        { urgency: 'haute', blocking: 'partiel', response: 24, resolution: 72 },
        { urgency: 'haute', blocking: 'non_bloquant', response: 24, resolution: 120 },
        { urgency: 'moyenne', blocking: 'bloquant', response: 24, resolution: 120 },
        { urgency: 'moyenne', blocking: 'partiel', response: 48, resolution: 168 },
        { urgency: 'moyenne', blocking: 'non_bloquant', response: 48, resolution: 168 },
        { urgency: 'basse', blocking: 'bloquant', response: 48, resolution: 168 },
        { urgency: 'basse', blocking: 'partiel', response: 120, resolution: 336 },
        { urgency: 'basse', blocking: 'non_bloquant', response: 120, resolution: 336 }
      ];

      for (const sla of slaConfigs) {
        await client.query(`
          INSERT INTO sla_configs (agency_id, urgency, blocking_level, response_time_hours, resolution_time_hours)
          VALUES ($1, $2, $3, $4, $5)
        `, [agencyId, sla.urgency, sla.blocking, sla.response, sla.resolution]);
      }
      console.log('✅ Configurations SLA créées');

      // 7. Créer les groupes de confidentialité par défaut
      console.log('\n🔒 Création des groupes de confidentialité...');
      const confGroups = [
        {
          name: 'Encadrement',
          description: 'Visible par les encadrants et au-dessus',
          can_read_levels: [1, 2, 3],
          can_write_levels: [1, 2, 3]
        },
        {
          name: 'Direction + Admin',
          description: 'Visible par la direction uniquement',
          can_read_levels: [2, 3],
          can_write_levels: [2, 3]
        },
        {
          name: 'Admin uniquement',
          description: 'Visible par les administrateurs uniquement',
          can_read_levels: [3],
          can_write_levels: [3]
        }
      ];

      for (const group of confGroups) {
        await client.query(`
          INSERT INTO confidentiality_groups (agency_id, name, description, can_read_levels, can_write_levels)
          VALUES ($1, $2, $3, $4, $5)
        `, [agencyId, group.name, group.description, JSON.stringify(group.can_read_levels), JSON.stringify(group.can_write_levels)]);
        console.log(`  ✅ Groupe: ${group.name}`);
      }

    } else {
      console.log('⏭️  Agence de démonstration existe déjà');
    }

    await client.query('COMMIT');
    console.log('\n🎉 Données initiales insérées avec succès!');

    console.log('\n' + '='.repeat(50));
    console.log('📋 INFORMATIONS DE CONNEXION:');
    console.log('='.repeat(50));
    console.log(`Email: ${process.env.DEFAULT_ADMIN_EMAIL || 'admin@sos.local'}`);
    console.log(`Mot de passe: ${process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMeOnFirstLogin!'}`);
    console.log('='.repeat(50));
    console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    console.log('='.repeat(50) + '\n');

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = seedInitialData;
