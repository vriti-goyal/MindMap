require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  console.log("Retrieving first user...");
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No users found in database! Register a user first.");
    return;
  }
  console.log(`Creating blank map for user: ${user.id} (${user.email})...`);
  const newMap = await prisma.map.create({
    data: {
      userId: user.id,
      title: 'Test Manual Map',
      tags: ''
    }
  });
  console.log("SUCCESS! Created map:", newMap);
}

main()
  .catch(e => {
    console.error("Prisma Map Creation Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
