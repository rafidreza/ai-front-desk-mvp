const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const knowledgeEntries = require('../src/knowledge/pilot-knowledge.json');
require('dotenv').config({ path: '../../.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const pilotClient = {
  id: 'pilot-client',
  businessName: 'Pilot F-Commerce Shop',
  pageId: 'pilot-page',
  ownerName: 'Pilot Owner',
  ownerEmail: 'owner@example.com',
  ownerPhone: '+8801000000000',
  businessCategory: 'clothing',
  onboardingStatus: 'active',
  defaultLanguage: 'mixed',
  tone: 'friendly, concise, helpful, and natural for Bangladeshi Messenger commerce',
  whatsappPoc: '+8801000000000',
  digestEmail: 'owner@example.com',
  escalationKeywords: [
    'refund',
    'angry',
    'complain',
    'complaint',
    'wrong product',
    'cancel',
    'manager',
    'human',
    'মানুষ',
    'রিফান্ড',
    'অভিযোগ',
  ],
};

async function main() {
  await prisma.client.upsert({
    where: { id: pilotClient.id },
    update: pilotClient,
    create: pilotClient,
  });

  for (const entry of knowledgeEntries) {
    await prisma.knowledgeEntry.upsert({
      where: { id: entry.id },
      update: {
        ...entry,
        clientId: pilotClient.id,
        status: 'active',
        version: 1,
      },
      create: {
        ...entry,
        clientId: pilotClient.id,
        status: 'active',
        version: 1,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
    console.log('Seeded pilot client and knowledge base.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
