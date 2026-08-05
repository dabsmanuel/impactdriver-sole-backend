import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { RegulatoryDefinition } from '../models/RegulatoryDefinition';
import { z } from 'zod';

const regulatoryDefinitionSchema = z.object({
  framework: z.enum(['GRI', 'ISSB', 'IFC', 'TNFD', 'NUPRC']),
  code: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  mandatory: z.boolean(),
  applicableProjectTypes: z.array(z.string()).default([]),
  requiredSections: z.array(z.string()).default([]),
});

const updateRegulatoryDefinitionSchema = regulatoryDefinitionSchema.partial();

/**
 * GET /api/regulatory-definitions?framework=GRI
 * Lists all definitions, optionally filtered by framework.
 */
export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { framework } = req.query;
    const filter: Record<string, unknown> = {};
    if (framework) filter['framework'] = framework;

    const definitions = await RegulatoryDefinition.find(filter).sort({ framework: 1, code: 1 }).lean();
    res.json({ definitions });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/regulatory-definitions
 * Creates a new regulatory definition. Requires admin role.
 */
export async function create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = regulatoryDefinitionSchema.parse(req.body);
    const definition = await RegulatoryDefinition.create(body);
    res.status(201).json(definition);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/regulatory-definitions/:id
 * Updates an existing definition. Requires admin role.
 */
export async function update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = updateRegulatoryDefinitionSchema.parse(req.body);
    const definition = await RegulatoryDefinition.findByIdAndUpdate(
      req.params['id'],
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!definition) {
      res.status(404).json({ error: 'Regulatory definition not found' });
      return;
    }
    res.json(definition);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/regulatory-definitions/:id
 * Removes a definition. Requires admin role.
 */
export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const definition = await RegulatoryDefinition.findByIdAndDelete(req.params['id']);
    if (!definition) {
      res.status(404).json({ error: 'Regulatory definition not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
