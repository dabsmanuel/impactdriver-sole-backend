import { Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { EngineSnapshot } from '../models/EngineSnapshot';
import { EngineName } from '../models/EngineContributionMap';

/**
 * Internal helper — creates a new immutable snapshot for the given engine.
 * Atomically deactivates all previous snapshots for that engine and activates
 * the new one. Uses a Mongoose session for atomicity.
 */
export async function createSnapshot(
  engineName: EngineName,
  data: unknown,
  projectIds: string[],
  userId: string | Types.ObjectId,
  jobId?: Types.ObjectId
): Promise<Types.ObjectId> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Auto-increment: find max version for this engine
    const latest = await EngineSnapshot.findOne({ engine: engineName })
      .sort({ version: -1 })
      .select('version')
      .session(session)
      .lean();

    const nextVersion = (latest?.version ?? 0) + 1;

    // Deactivate all previous snapshots for this engine
    await EngineSnapshot.updateMany(
      { engine: engineName, isActive: true },
      { $set: { isActive: false } },
      { session }
    );

    // Create the new active snapshot
    const [snapshot] = await EngineSnapshot.create(
      [
        {
          engine: engineName,
          version: nextVersion,
          data,
          projectIds,
          jobId,
          isActive: true,
          createdBy: new Types.ObjectId(userId.toString()),
          createdAt: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return snapshot._id;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * GET /api/engine-snapshots?engine=X
 * Returns metadata list (no data field) for a given engine.
 */
export async function listSnapshots(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { engine, activeOnly } = req.query;

    const filter: Record<string, unknown> = {};
    if (engine) filter['engine'] = engine;
    if (activeOnly === 'true') filter['isActive'] = true;

    const snapshots = await EngineSnapshot.find(filter)
      .select('-data')
      .sort({ engine: 1, version: -1 })
      .lean();

    res.json({ snapshots });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/engine-snapshots/:id
 * Returns a full snapshot including data.
 */
export async function getSnapshot(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const snapshot = await EngineSnapshot.findById(req.params['id']).lean();
    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
}
