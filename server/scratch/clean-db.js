require('dotenv').config();
const prisma = require('../src/config/prisma');

async function clean() {
  try {
    console.log('Inspecting active database processes...');
    const activities = await prisma.$queryRawUnsafe(`
      SELECT pid, query, state, age(clock_timestamp(), query_start)::text as age, wait_event_type, wait_event
      FROM pg_stat_activity 
      WHERE state != 'idle' AND pid != pg_backend_pid();
    `);
    
    console.log('Active Activities:', activities);
    
    if (activities.length > 0) {
      console.log('Terminating blocking queries...');
      for (const act of activities) {
        console.log(`Killing process ${act.pid}: ${act.query}`);
        await prisma.$queryRawUnsafe(`SELECT pg_terminate_backend(${act.pid});`);
      }
      console.log('Cleaned up!');
    } else {
      console.log('No blocking processes found.');
    }
  } catch (err) {
    console.error('Clean DB failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
