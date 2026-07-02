import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { EngineContributionMap, ENGINE_NAMES, EngineName } from '../models/EngineContributionMap';
import { z } from 'zod';

const engineMapSchema = z.object({
  contributions: z.array(
    z.object({
      engine: z.enum(ENGINE_NAMES),
      contributed: z.boolean(),
      mostValuableInsight: z.string(),
    })
  ),
});

export async function getEngineMap(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const map = await EngineContributionMap.findOne({ project: req.params['projectId'] }).lean();
    if (!map) { res.status(404).json({ error: 'Engine map not found' }); return; }
    res.json(map);
  } catch (err) {
    next(err);
  }
}

export async function updateEngineMap(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = engineMapSchema.parse(req.body);
    const map = await EngineContributionMap.findOneAndUpdate(
      { project: req.params['projectId'] },
      { contributions: body.contributions },
      { new: true, runValidators: true }
    );
    if (!map) { res.status(404).json({ error: 'Engine map not found' }); return; }
    res.json(map);
  } catch (err) {
    next(err);
  }
}
