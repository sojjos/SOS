const { pool } = require('../config/database');
const seedInitialData = require('./001_initial_data');
require('dotenv').config();

async function runSeeds() {
  console.log('🌱 Démarrage du seeding...\n');

  try {
    await seedInitialData();
    console.log('🎉 Seeding terminé avec succès!');
  } catch (err) {
    console.error('❌ Erreur lors du seeding:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeeds();
