import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';
import { seedAdmin } from './scripts/seed';

async function main(): Promise<void> {
  await connectDB();
  await seedAdmin();
  app.listen(env.PORT, () => {
    console.log(`[server] IIF backend running on port ${env.PORT}`);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
