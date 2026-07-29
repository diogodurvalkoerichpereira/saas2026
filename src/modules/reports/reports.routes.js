const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { financialSummary, operationalSummary } = require('./reports.service');

router.use(authenticate);
router.get('/financial', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => { try { res.json(await financialSummary(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.get('/operational', async (req, res, next) => { try { res.json(await operationalSummary(Number(req.auth.companyId))); } catch (error) { next(error); } });
module.exports = router;
