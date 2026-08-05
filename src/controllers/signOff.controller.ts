import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SignOff, SignOffRole } from '../models/SignOff';
import { Project } from '../models/Project';
import { z } from 'zod';

// GAP 1: cross-validate that signed=true requires an explicit date
const signatureSchema = z.object({
  role: z.enum(['Uptonville Technical Reviewer', 'Impact Driver Analyst', 'Joint Steering Committee']),
  name: z.string().min(1),
  signed: z.boolean(),
  date: z.coerce.date().optional(),
}).superRefine((val, ctx) => {
  if (val.signed && !val.date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'date is required when signed is true',
      path: ['date'],
    });
  }
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

    // GAP 1: Zod superRefine will reject signed=true without a date
    const parsed = patchSignOffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message ?? 'Validation error', details: parsed.error.errors });
      return;
    }
    const { role, name, signed, date } = parsed.data.signature;

    const signOff = await SignOff.findOne({ project: req.params['projectId'] });
    if (!signOff) { res.status(404).json({ error: 'SignOff not found' }); return; }

    const entry = signOff.signatures.find((s) => s.role === role);
    if (!entry) { res.status(400).json({ error: `No signature slot for role: ${role}` }); return; }

    entry.name = name;
    entry.signed = signed;
    // GAP 1: date is only set when explicitly provided (superRefine guarantees it exists when signed=true)
    if (signed && date) {
      entry.date = date;
    } else if (!signed) {
      entry.date = undefined;
    }

    await signOff.save();

    // GAP 1: allSigned requires signed=true AND name AND date on every entry
    const allSigned = signOff.signatures.every((s) => s.signed && !!s.name && !!s.date);
    if (allSigned) {
      await Project.findByIdAndUpdate(req.params['projectId'], { status: 'signed-off' });
    }

    res.json(signOff);
  } catch (err) {
    next(err);
  }
}
