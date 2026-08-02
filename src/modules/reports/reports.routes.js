const router = require('express').Router();
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { feature } = require('../../middlewares/feature');
const { z } = require('zod');
const { listResponse } = require('../../lib/list-response');
const {
  financialSummary, operationalSummary, salesReport, cashFlowReport, inventoryReport, delinquencyReport, cashReport,
  topProductsReport, annualBalanceReport, syntheticPayablesReport, syntheticReceivablesReport
} = require('./reports.service');

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
function period(raw) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  return z.object({ from: date.default(first), to: date.default(today.toISOString().slice(0, 10)) }).parse(raw);
}

router.use(authenticate, permit('home', 'rel_financeiro', 'rel_vendas', 'rel_balanco', 'rel_prod_vendidos', 'rel_sintetico_despesas', 'rel_sintetico_receber'), feature('relatorios'));
router.get('/financial', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => { try { res.json(await financialSummary(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.get('/operational', async (req, res, next) => { try { res.json(await operationalSummary(Number(req.auth.companyId))); } catch (error) { next(error); } });
router.get('/sales', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await salesReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['cliente_nome', 'vendedor_nome'], dateField: 'data', defaultSort: 'data' })); } catch (error) { next(error); }
});
router.get('/cash-flow', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await cashFlowReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['tipo', 'descricao'], dateField: 'data', defaultSort: 'data' })); } catch (error) { next(error); }
});
router.get('/inventory', async (req, res, next) => {
  try { res.json(listResponse(await inventoryReport(Number(req.auth.companyId)), req.query, { searchFields: ['codigo', 'nome', 'categoria_nome', 'fornecedor_nome'], statusField: 'estoque_baixo', defaultSort: 'nome' })); } catch (error) { next(error); }
});
router.get('/delinquency', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await delinquencyReport(Number(req.auth.companyId)), req.query, { searchFields: ['descricao', 'cliente_nome', 'telefone', 'email'], dateField: 'vencimento', defaultSort: 'vencimento' })); } catch (error) { next(error); }
});
router.get('/cash-registers', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await cashReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['operador_nome', 'obs'], dateField: 'data_abertura', defaultSort: 'data_abertura' })); } catch (error) { next(error); }
});
router.get('/top-products', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await topProductsReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['codigo', 'nome'], defaultSort: 'quantidade_vendida' })); } catch (error) { next(error); }
});
router.get('/annual-balance', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try {
    const year = z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()).parse(req.query.year);
    res.json(listResponse(await annualBalanceReport(Number(req.auth.companyId), year), req.query, { defaultSort: 'mes' }));
  } catch (error) { next(error); }
});
router.get('/synthetic-payables', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await syntheticPayablesReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['categoria'], defaultSort: 'pendente' })); } catch (error) { next(error); }
});
router.get('/synthetic-receivables', authorize('Administrador', 'Gerente', 'Tesoureiro', 'Financeiro'), async (req, res, next) => {
  try { res.json(listResponse(await syntheticReceivablesReport(Number(req.auth.companyId), period(req.query)), req.query, { searchFields: ['categoria'], defaultSort: 'pendente' })); } catch (error) { next(error); }
});
module.exports = router;
