import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Public self-registration — only client roles allowed; role defaults to client_data_submitter
export const clientRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  company: z.string().min(1, 'Company name is required'),
  role: z.enum(['client_data_submitter', 'client_executive']).default('client_data_submitter'),
});
