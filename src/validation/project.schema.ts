import { z } from 'zod';
import { PROJECT_TYPES, OPERATING_ENVIRONMENTS, PROJECT_STATUSES, VALUE_SCALES } from '../models/Project';

export const createProjectSchema = z.object({
  name: z.string().min(1),
  projectType: z.enum(PROJECT_TYPES),
  location: z.string().min(1),
  operatingEnvironment: z.enum(OPERATING_ENVIRONMENTS),
  client: z.string().min(1),
  operator: z.string().min(1),
  duration: z.object({
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
  }),
  valueScale: z.enum(VALUE_SCALES),
  valueAmount: z.number().positive().optional(),
  description: z.string().min(1),
  dataReadinessTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  status: z.enum(PROJECT_STATUSES).optional(),
  availableDocs: z
    .object({
      reports: z.boolean(),
      monitoringData: z.boolean(),
      gis: z.boolean(),
      photographs: z.boolean(),
      drawings: z.boolean(),
    })
    .optional(),
});

export const updateProjectSchema = createProjectSchema.partial();
