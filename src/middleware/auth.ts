import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, UserRole } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
    name: string;
    company: string; // GAP 5b
  };
}

interface JwtPayload {
  id: string;
  role: UserRole;
  email: string;
  name: string;
  company: string; // GAP 5b
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = { id: payload.id, role: payload.role, email: payload.email, name: payload.name, company: payload.company ?? '' };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

// Section-level edit permission: uptonville_reviewer owns A/D/G/H; analyst owns B/C/E/F/I/J; admin can edit all.
const SECTION_OWNERS: Record<string, UserRole[]> = {
  a: ['uptonville_reviewer', 'admin'],
  d: ['uptonville_reviewer', 'admin'],
  g: ['uptonville_reviewer', 'admin'],
  h: ['uptonville_reviewer', 'admin'],
  b: ['impact_driver_analyst', 'admin'],
  c: ['impact_driver_analyst', 'admin'],
  e: ['impact_driver_analyst', 'admin'],
  f: ['impact_driver_analyst', 'admin'],
  i: ['impact_driver_analyst', 'admin'],
  j: ['impact_driver_analyst', 'admin'],
};

export function requireSectionEditRole(req: AuthRequest, res: Response, next: NextFunction): void {
  const section = req.params['section']?.toLowerCase();
  if (!section || !req.user) {
    res.status(400).json({ error: 'Section required' });
    return;
  }
  const allowed = SECTION_OWNERS[section];
  if (!allowed) {
    res.status(400).json({ error: `Unknown section: ${section}` });
    return;
  }
  if (!allowed.includes(req.user.role)) {
    res.status(403).json({ error: `Role ${req.user.role} cannot edit section ${section.toUpperCase()}` });
    return;
  }
  next();
}
