import { env } from '../config/env';
import { User } from '../models/User';

export async function seedAdmin(): Promise<void> {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) return;

  const exists = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (exists) return;

  await User.create({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    name: env.SEED_ADMIN_NAME,
    role: 'admin',
  });
  console.log(`[seed] Admin user created: ${env.SEED_ADMIN_EMAIL}`);
}
