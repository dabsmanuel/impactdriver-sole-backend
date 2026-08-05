import { z } from 'zod';

const indicatorEntrySchema = z.object({
  indicatorName: z.string().min(1),
  category: z.enum(['E', 'S', 'G']),
  unit: z.string().min(1),
  measurementMethod: z.string().min(1),
  whyItMattered: z.string().min(1),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const regulatoryRuleSchema = z.object({
  category: z.string().min(1),
  regulationStandard: z.string().min(1),
  issuingBody: z.string().min(1),
  howItApplied: z.string().default(''),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const stakeholderSchema = z.object({
  stakeholderGroup: z.string().min(1),
  interestConcern: z.string().default(''),
  reportingFormatNeeded: z.string().default(''),
  engagementOutcome: z.string().default(''),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const decisionSupportSchema = z.object({
  mitigationMeasure: z.string().min(1),
  effectiveness: z.enum(['high', 'medium', 'low']),
  evidenceForRating: z.string().default(''),
  recommendedFuture: z.string().default(''),
  expertReasoning: z.string().default(''),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const evidenceSchema = z.object({
  regulationStandard: z.string().min(1),
  issuingBody: z.string().min(1),
  evidenceType: z.string().default(''),
  formatFrequency: z.string().default(''),
  acceptedWithoutDispute: z.boolean(),
  disputeNotes: z.string().optional(),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const disclosureSchema = z.object({
  disclosureTopic: z.string().min(1),
  alignedFramework: z.enum(['GRI', 'ISSB', 'IFC', 'TNFD', 'NUPRC']),
  whyValuable: z.string().default(''),
  gapFlag: z.boolean().optional().default(false),  // GAP 10b
  gapNote: z.string().optional().default(''),      // GAP 10b
});

const sectionGSchema = z.object({
  outcomesAchieved: z.string().optional(),
  measurementMethod: z.string().optional(),
  timeframe: z.string().optional(),
  outstandingIssues: z.string().optional(),
});

const sectionHSchema = z.object({
  positiveImpacts: z.string().optional(),
  negativeImpacts: z.string().optional(),
  grievanceMechanism: z.string().optional(),
  grievanceOutcome: z.string().optional(),
});

const sectionJSchema = z.object({
  dataDifficultToCollect: z.string().optional(),
  manualProcesses: z.string().optional(),
  automationOpportunity: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional(),
});

const sectionASchema = z.object({
  name: z.string().optional(),
  referenceCode: z.string().optional(),
  projectType: z.string().optional(),
  location: z.string().optional(),
  operatingEnvironment: z.string().optional(),
  client: z.string().optional(),
  operator: z.string().optional(),
  duration: z.object({ start: z.coerce.date().optional(), end: z.coerce.date().optional() }).optional(),
  valueScale: z.string().optional(),
  valueAmount: z.number().optional(),
  description: z.string().optional(),
  dataReadinessTier: z.number().optional(),
});

const extractionStatusSchema = z.enum(['not-started', 'in-progress', 'complete']);

export const sectionPayloadSchemas = {
  a: z.object({ data: sectionASchema, status: extractionStatusSchema.optional() }),
  b: z.object({ data: z.array(indicatorEntrySchema), status: extractionStatusSchema.optional() }),
  c: z.object({ data: z.array(regulatoryRuleSchema), status: extractionStatusSchema.optional() }),
  d: z.object({ data: z.array(stakeholderSchema), status: extractionStatusSchema.optional() }),
  e: z.object({ data: z.array(decisionSupportSchema), status: extractionStatusSchema.optional() }),
  f: z.object({ data: z.array(evidenceSchema), status: extractionStatusSchema.optional() }),
  g: z.object({ data: sectionGSchema, status: extractionStatusSchema.optional() }),
  h: z.object({ data: sectionHSchema, status: extractionStatusSchema.optional() }),
  i: z.object({ data: z.array(disclosureSchema), status: extractionStatusSchema.optional() }),
  j: z.object({ data: sectionJSchema, status: extractionStatusSchema.optional() }),
} as const;

export type SectionKey = keyof typeof sectionPayloadSchemas;
