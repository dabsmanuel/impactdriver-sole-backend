import { Router } from 'express';
import {
  projectClassification,
  regulatoryRules,
  indicatorLibrary,
  materialityEngine,
  stakeholderIntelligence,
  decisionSupport,
  benchmarking,
  reportingTemplates,
  reportPreview,
  enginesSummary,
  systemStats,
} from '../controllers/engines.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/project-classification', projectClassification);
router.get('/regulatory-rules', regulatoryRules);
router.get('/indicator-library', indicatorLibrary);
router.get('/materiality', materialityEngine);
router.get('/stakeholder-intelligence', stakeholderIntelligence);
router.get('/decision-support', decisionSupport);
router.get('/benchmarking', benchmarking);
router.get('/reporting', reportingTemplates);
router.get('/report-preview', reportPreview);
router.get('/summary', enginesSummary);
router.get('/stats', systemStats);

export default router;
