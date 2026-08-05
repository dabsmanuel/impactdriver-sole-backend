import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';
import { registerSchema, loginSchema } from '../validation/auth.schema';
import { AuthRequest } from '../middleware/auth';

function signToken(payload: { id: string; role: string; email: string; name: string; company: string }): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: body.email });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    const user = await User.create(body);
    const token = signToken({ id: user.id, role: user.role, email: user.email, name: user.name, company: user.company ?? '' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, company: user.company } });
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
