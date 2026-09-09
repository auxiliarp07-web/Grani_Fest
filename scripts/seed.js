const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function seed() {
  await client.connect();

  const companies = [
    { name: 'La Cabaña Grill', description: 'Asado premium y sabor auténtico', website: 'https://lacabanagrill.com' },
    { name: 'Fuego & Madera', description: 'Parrillas con enfoque gourmet', website: 'https://fuegoymadera.com' },
    { name: 'Urban Burger Co', description: 'Burger moderno con ingredientes locales', website: 'https://urbanburgerco.com' }
  ];

  const created = await Promise.all(
    companies.map((brand) => client.query(
      'INSERT INTO companies (name, description, website) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *',
      [brand.name, brand.description, brand.website]
    ))
  );

  const companyRows = created.flatMap((result) => result.rows);

  const adminEmail = 'admin@granifest.dev';
  const brandEmail = 'brand@granifest.dev';
  const userEmail = 'user@granifest.dev';

  await client.query(
    `INSERT INTO users (email, name, role, company_id)
     VALUES ($1, $2, 'admin', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [adminEmail, 'Administrador Grani Fest']
  );

  if (companyRows[0]) {
    await client.query(
      `INSERT INTO users (email, name, role, company_id)
       VALUES ($1, $2, 'brand', $3)
       ON CONFLICT (email) DO NOTHING`,
      [brandEmail, 'Marca Demo', companyRows[0].id]
    );
  }

  await client.query(
    `INSERT INTO users (email, name, role)
     VALUES ($1, $2, 'user')
     ON CONFLICT (email) DO NOTHING`,
    [userEmail, 'Usuario Demo']
  );

  console.log('Database seeded with demo users and companies.');
  await client.end();
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
