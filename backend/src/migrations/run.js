const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
require('dotenv').config();

async function runMigrations() {
  console.log('🚀 Démarrage des migrations...\n');

  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const client = await pool.connect();

  try {
    // Créer la table de suivi des migrations si elle n'existe pas
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const file of files) {
      // Vérifier si la migration a déjà été exécutée
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Migration ${file} déjà exécutée, ignorée.`);
        continue;
      }

      console.log(`📄 Exécution de ${file}...`);

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Migration ${file} exécutée avec succès.\n`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Erreur dans ${file}:`, err.message);
        throw err;
      }
    }

    console.log('🎉 Toutes les migrations ont été exécutées avec succès!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
