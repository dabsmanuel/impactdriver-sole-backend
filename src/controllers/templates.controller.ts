import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { Project } from '../models/Project';
import { sectionPayloadSchemas, SectionKey } from '../validation/template.schema';

export async function getTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // GAP 5d: client_executive cannot access template data
    if (req.user?.role === 'client_executive') {
      res.status(403).json({ error: 'client_executive role cannot access template data' });
      return;
    }

    const template = await ProjectTemplate.findOne({ project: req.params['projectId'] }).lean();
    if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
    res.json(template);
  } catch (err) {
    next(err);
  }
}

export async function patchSection(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { projectId, section } = req.params as { projectId: string; section: string };
    const sectionKey = section.toLowerCase() as SectionKey;

    const schema = sectionPayloadSchemas[sectionKey];
    if (!schema) {
      res.status(400).json({ error: `Unknown section: ${section}` });
      return;
    }

    const payload = schema.parse(req.body);

    const sectionDataKey = `section${sectionKey.toUpperCase()}`;
    const update: Record<string, unknown> = {
      [sectionDataKey]: payload.data,
    };
    if (payload.status) {
      update[`extractionStatus.${sectionKey}`] = payload.status;
    }

    const template = await ProjectTemplate.findOneAndUpdate(
      { project: projectId },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

    // Sync sectionA back to the Project document
    if (sectionKey === 'a' && payload.data) {
      await Project.findByIdAndUpdate(projectId, { $set: payload.data });
    }

    const templateObj = template.toObject() as unknown as Record<string, unknown>;
    res.json({ extractionStatus: template.extractionStatus, [sectionDataKey]: templateObj[sectionDataKey] });
  } catch (err) {
    next(err);
  }
}
