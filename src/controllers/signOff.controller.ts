import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SignOff, SignOffRole } from '../models/SignOff';
import { Project } from '../models/Project';
import { z } from 'zod';

const signatureSchema = z.object({
  role: z.enum(['Uptonville Technical Reviewer', 'Impact Driver Analyst', 'Joint Steering Committee']),
  name: z.string().min(1),
  signed: z.boolean(),
  date: z.coerce.date().optional(),
});

const patchSignOffSchema = z.object({
  signature: signatureSchema,
});

export async function getSignOff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const signOff = await SignOff.findOne({ project: req.params['projectId'] }).lean();
    if (!signOff) { res.status(404).json({ error: 'SignOff not found' }); return; }
    res.json(signOff);
  } catch (err) {
    next(err);
  }
}

export async function patchSignOff(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user?.role !== 'steering_committee' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Only steering committee or admin can update sign-off' });
      return;
    }

    const body = patchSignOffSchema.parse(req.body);
    const { role, name, signed, date } = body.signature;

    const signOff = await SignOff.findOne({ project: req.params['projectId'] });
    if (!signOff) { res.status(404).json({ error: 'SignOff not found' }); return; }

    const entry = signOff.signatures.find((s) => s.role === role);
    if (!entry) { res.status(400).json({ error: `No signature slot for role: ${role}` }); return; }

    entry.name = name;
    entry.signed = signed;
    if (signed) entry.date = date ?? new Date();

    await signOff.save();

    // If all signatures are signed, move project to signed-off
    const allSigned = signOff.signatures.every((s) => s.signed);
    if (allSigned) {
      await Project.findByIdAndUpdate(req.params['projectId'], { status: 'signed-off' });
    }

    res.json(signOff);
  } catch (err) {
    next(err);
  }
}
