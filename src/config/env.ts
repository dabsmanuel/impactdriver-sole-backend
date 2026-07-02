import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const env = {
  PORT: parseInt(process.env['PORT'] ?? '4000', 10),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] ?? '7d',
  FRONTEND_ORIGIN: process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:3000',
  SEED_ADMIN_EMAIL: process.env['SEED_ADMIN_EMAIL'],
  SEED_ADMIN_PASSWORD: process.env['SEED_ADMIN_PASSWORD'],
  SEED_ADMIN_NAME: process.env['SEED_ADMIN_NAME'] ?? 'System Admin',
};
