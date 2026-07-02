import { Request, Response, NextFunction } from 'express';
import { Project } from '../models/Project';
import { ProjectTemplate } from '../models/ProjectTemplate';

function escapeCsv(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers: string[], rows: (unknown[])[]): string {
  return [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

export async function exportProjects(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projects = await Project.find({}).sort({ createdAt: -1 }).lean();
    const headers = [
      'Reference Code', 'Name', 'Project Type', 'Location', 'Operating Environment',
      'Client', 'Operator', 'Status', 'Tier', 'Value Scale', 'Value Amount',
      'Duration Start', 'Duration End', 'Created At',
    ];
    const rows = projects.map((p) => [
      p.referenceCode, p.name, p.projectType, p.location, p.operatingEnvironment,
      p.client, p.operator, p.status, p.dataReadinessTier, p.valueScale, p.valueAmount ?? '',
      p.duration?.start ? new Date(p.duration.start).toISOString().slice(0, 10) : '',
      p.duration?.end ? new Date(p.duration.end).toISOString().slice(0, 10) : '',
      new Date(p.createdAt as Date).toISOString().slice(0, 10),
    ]);
    const csv = toCsv(headers, rows);
    const filename = `IIF-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
}

export async function exportIndicators(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const templates = await ProjectTemplate.find({}).populate('project', 'name referenceCode').lean();
    const headers = [
      'Project Reference', 'Project Name', 'Category', 'Indicator Name', 'Unit', 'Measurement Method', 'Why It Mattered',
    ];
    const rows: unknown[][] = [];
    for (const t of templates) {
      const proj = t.project as { referenceCode?: string; name?: string } | null;
      for (const ind of t.sectionB) {
        rows.push([
          proj?.referenceCode ?? '', proj?.name ?? '',
          ind.category, ind.indicatorName, ind.unit, ind.measurementMethod, ind.whyItMattered,
        ]);
      }
    }
    const csv = toCsv(headers, rows);
    const filename = `IIF-indicators-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) { next(err); }
}
