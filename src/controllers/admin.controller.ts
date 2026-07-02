import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { ProjectTemplate } from '../models/ProjectTemplate';
import type { UserRole } from '../models/User';

const SAFE_FIELDS = 'email name role createdAt updatedAt';

export async function listUsers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await User.find({}, SAFE_FIELDS).sort({ createdAt: -1 }).lean();
    res.json({ users, total: users.length });
  } catch (err) { next(err); }
}

export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, name, role, password } = req.body as {
      email: string; name: string; role: UserRole; password: string;
    };
    if (!email || !name || !role || !password) {
      res.status(400).json({ error: 'email, name, role, and password are required' });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

    const user = await User.create({ email, name, role, password });
    const created = await User.findById(user._id).select(SAFE_FIELDS).lean();
    res.status(201).json({ user: created });
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, role } = req.body as { name?: string; role?: UserRole };
    const update: Partial<{ name: string; role: UserRole }> = {};
    if (name) update.name = name;
    if (role) update.role = role;
    const user = await User.findByIdAndUpdate(id, update, { new: true, select: SAFE_FIELDS });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { password } = req.body as { password: string };
    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' }); return;
    }
    const user = await User.findById(id).select('+password');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    user.password = password;  // pre-save hook hashes it
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function backfillSectionA(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projects = await Project.find({}).lean();
    let updated = 0;

    await Promise.all(projects.map(async (p) => {
      const result = await ProjectTemplate.updateOne(
        { project: p._id, 'sectionA.name': { $in: [null, undefined, ''] } },
        {
          $set: {
            'sectionA.name': p.name,
            'sectionA.referenceCode': p.referenceCode,
            'sectionA.projectType': p.projectType,
            'sectionA.location': p.location,
            'sectionA.operatingEnvironment': p.operatingEnvironment,
            'sectionA.client': p.client,
            'sectionA.operator': p.operator,
            'sectionA.duration': p.duration,
            'sectionA.valueScale': p.valueScale,
            'sectionA.valueAmount': p.valueAmount,
            'sectionA.description': p.description,
            'sectionA.dataReadinessTier': p.dataReadinessTier,
          },
        }
      );
      if (result.modifiedCount > 0) updated++;
    }));

    res.json({ message: `Backfilled sectionA for ${updated} project(s)` });
  } catch (err) { next(err); }
}
