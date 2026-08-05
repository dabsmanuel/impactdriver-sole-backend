import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';
import { clientRegisterSchema, loginSchema } from '../validation/auth.schema';
import { AuthRequest } from '../middleware/auth';

function signToken(payload: { id: string; role: string; email: string; name: string; company: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

// Public self-registration for clients — account starts as 'pending' until admin approves
export async function registerClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = clientRegisterSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    await User.create({ ...body, status: 'pending' });
    // Intentionally no token — account must be approved by admin first
    res.status(201).json({ message: 'Account request submitted. You will receive access once an administrator approves your account.' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);
    const user = await User.findOne({ email: body.email }).select('+password');
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await user.comparePassword(body.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (user.status === 'pending') {
      res.status(403).json({ error: 'Your account is pending admin approval. You will be notified when access is granted.' });
      return;
    }
    if (user.status === 'suspended') {
      res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
      return;
    }
    const token = signToken({ id: user.id, role: user.role, email: user.email, name: user.name, company: user.company ?? '' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, company: user.company } });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, company: user.company });
  } catch (err) {
    next(err);
  }
}
