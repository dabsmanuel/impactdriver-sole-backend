import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';
import { seedAdmin } from './scripts/seed';
import { seedRegulatoryDefinitions } from './scripts/seedDefinitions'; // GAP 11

async function main(): Promise<void> {
  await connectDB();
  await seedAdmin();
  await seedRegulatoryDefinitions(); // GAP 11
  app.listen(env.PORT, () => {
    console.log(`[server] IIF backend running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
