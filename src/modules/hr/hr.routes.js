const router = require('express').Router();
const { z } = require('zod');
const { pool } = require('../../config/database');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { permit } = require('../../middlewares/permit');
const { listResponse } = require('../../lib/list-response');
const { audit } = require('../../services/audit.service');

const id = z.coerce.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable();
const yesNo = z.enum(['Sim', 'Não']);
const attendanceSchema = z.object({
  employeeId: z.number().int().positive(),
  date,
  clockIn: time.optional(),
  lunchStart: time.optional(),
  lunchEnd: time.optional(),
  clockOut: time.optional(),
  dayOff: yesNo.optional(),
  holiday: yesNo.optional(),
  absent: yesNo.optional()
});

function seconds(value) {
  if (!value) return null;
  const [hours, minutes, secs = 0] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + secs;
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
}

function calculateTimes(data, planned) {
  const clockIn = seconds(data.clockIn);
  const clockOut = seconds(data.clockOut);
  const lunchStart = seconds(data.lunchStart);
  const lunchEnd = seconds(data.lunchEnd);
  const worked = clockIn !== null && clockOut !== null
    ? Math.max(0, clockOut - clockIn - (lunchStart !== null && lunchEnd !== null ? Math.max(0, lunchEnd - lunchStart) : 0))
    : 0;
  const interval = lunchStart !== null && lunchEnd !== null ? Math.max(0, lunchEnd - lunchStart) : 0;
  const plannedSeconds = seconds(planned) || 0;
  return { total: formatTime(worked), interval: formatTime(interval), overtime: formatTime(Math.max(0, worked - plannedSeconds)) };
}

router.use(authenticate, permit('rh', 'funcionarios'));

router.get('/attendance', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT j.id, j.funcionario AS employeeId, j.data, j.entrada AS clockIn, j.entrada_almoco AS lunchStart,
              j.saida_almoco AS lunchEnd, j.saida AS clockOut, j.total_horas AS totalHours,
              j.intervalo AS breakTime, j.hora_extra AS overtime, j.folga AS dayOff, j.feriado AS holiday,
              j.falta AS absent, j.empresa, u.nome AS employeeName
         FROM jornada j JOIN usuarios u ON u.id = j.funcionario AND u.empresa = j.empresa
        WHERE j.empresa = ? ORDER BY j.data DESC, u.nome`,
      [Number(req.auth.companyId)]
    );
    res.json(listResponse(rows, req.query, { searchFields: ['employeeName'], dateField: 'data', defaultSort: 'data' }));
  } catch (error) { next(error); }
});
router.post('/attendance', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const data = attendanceSchema.parse(req.body);
    const [employees] = await pool.execute('SELECT jornada_horas FROM usuarios WHERE id = ? AND empresa = ? AND ativo = \'Sim\'', [data.employeeId, Number(req.auth.companyId)]);
    if (!employees[0]) throw Object.assign(new Error('Funcionário não encontrado.'), { status: 404 });
    const calculated = calculateTimes(data, employees[0].jornada_horas);
    const [existing] = await pool.execute('SELECT id FROM jornada WHERE funcionario = ? AND data = ? AND empresa = ? ORDER BY id LIMIT 1', [data.employeeId, data.date, Number(req.auth.companyId)]);
    const values = [
      data.clockIn ?? null, data.lunchStart ?? null, data.lunchEnd ?? null, data.clockOut ?? null,
      calculated.total, calculated.interval, calculated.overtime, data.dayOff ?? 'Não',
      data.holiday ?? 'Não', data.absent ?? 'Não', Number(req.auth.sub)
    ];
    let entryId;
    if (existing[0]) {
      entryId = existing[0].id;
      await pool.execute(
        `UPDATE jornada SET entrada = ?, entrada_almoco = ?, saida_almoco = ?, saida = ?, total_horas = ?,
                intervalo = ?, hora_extra = ?, folga = ?, feriado = ?, falta = ?, usuario_lanc = ?
          WHERE id = ? AND empresa = ?`,
        [...values, entryId, Number(req.auth.companyId)]
      );
    } else {
      const [result] = await pool.execute(
        `INSERT INTO jornada
          (funcionario, data, entrada, entrada_almoco, saida_almoco, saida, total_horas, intervalo, hora_extra,
           folga, feriado, falta, data_lanc, usuario_lanc, empresa)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_DATE, ?, ?)`,
        [data.employeeId, data.date, ...values.slice(0, 10), Number(req.auth.sub), Number(req.auth.companyId)]
      );
      entryId = result.insertId;
    }
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: existing[0] ? 'editar' : 'criar', entity: 'jornada', entityId: entryId });
    res.status(201).json({ id: entryId, ...calculated });
  } catch (error) { next(error); }
});
router.delete('/attendance/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const attendanceId = id.parse(req.params.id);
    const [result] = await pool.execute('DELETE FROM jornada WHERE id = ? AND empresa = ?', [attendanceId, Number(req.auth.companyId)]);
    if (!result.affectedRows) throw Object.assign(new Error('Registro de ponto não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: 'jornada', entityId: attendanceId, reason: req.body?.reason || null });
    res.status(204).end();
  } catch (error) { next(error); }
});
router.get('/payroll', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const filters = z.object({ from: date.optional(), to: date.optional() }).parse(req.query);
    const from = filters.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const to = filters.to || new Date().toISOString().slice(0, 10);
    const companyId = Number(req.auth.companyId);
    // Lançamentos manuais somam por competência (YYYY-MM) dentro do período consultado.
    const [rows] = await pool.execute(
      `SELECT u.id, u.nome, u.nivel, u.salario, u.valor_hora, u.jornada_horas,
              COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(j.total_horas))), '00:00:00') AS horas_trabalhadas,
              COALESCE(SEC_TO_TIME(SUM(TIME_TO_SEC(j.hora_extra))), '00:00:00') AS horas_extras,
              SUM(CASE WHEN j.falta = 'Sim' THEN 1 ELSE 0 END) AS faltas,
              COALESCE(fl.proventos, 0) AS proventos, COALESCE(fl.descontos, 0) AS descontos,
              ROUND(COALESCE(u.salario, 0) + (COALESCE(SUM(TIME_TO_SEC(j.hora_extra)), 0) / 3600) * COALESCE(u.valor_hora, 0)
                    + COALESCE(fl.proventos, 0) - COALESCE(fl.descontos, 0), 2) AS total_estimado
         FROM usuarios u
         LEFT JOIN jornada j ON j.funcionario = u.id AND j.empresa = u.empresa AND j.data BETWEEN ? AND ?
         LEFT JOIN (
           SELECT funcionario,
                  SUM(CASE WHEN tipo = 'provento' THEN valor ELSE 0 END) AS proventos,
                  SUM(CASE WHEN tipo = 'desconto' THEN valor ELSE 0 END) AS descontos
             FROM node_folha_lancamentos
            WHERE empresa = ? AND competencia BETWEEN ? AND ?
            GROUP BY funcionario
         ) fl ON fl.funcionario = u.id
        WHERE u.empresa = ? AND u.ativo = 'Sim' AND u.nivel <> 'Cliente'
        GROUP BY u.id, u.nome, u.nivel, u.salario, u.valor_hora, u.jornada_horas, fl.proventos, fl.descontos
        ORDER BY u.nome`,
      [from, to, companyId, from.slice(0, 7), to.slice(0, 7), companyId]
    );
    res.json({ from, to, items: rows });
  } catch (error) { next(error); }
});

const entrySchema = z.object({
  employeeId: z.number().int().positive(),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  tipo: z.enum(['provento', 'desconto']),
  descricao: z.string().trim().min(2).max(120),
  valor: z.number().positive()
});
router.get('/payroll/entries', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const f = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(), employeeId: id.optional() }).parse(req.query);
    const where = ['empresa = ?'];
    const params = [Number(req.auth.companyId)];
    if (f.competencia) { where.push('competencia = ?'); params.push(f.competencia); }
    if (f.employeeId) { where.push('funcionario = ?'); params.push(f.employeeId); }
    const [rows] = await pool.execute(
      `SELECT id, funcionario AS employeeId, competencia, tipo, descricao, valor FROM node_folha_lancamentos WHERE ${where.join(' AND ')} ORDER BY id DESC`,
      params
    );
    res.json({ items: rows });
  } catch (error) { next(error); }
});
router.post('/payroll/entries', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const data = entrySchema.parse(req.body);
    const [emp] = await pool.execute('SELECT id FROM usuarios WHERE id = ? AND empresa = ?', [data.employeeId, Number(req.auth.companyId)]);
    if (!emp[0]) throw Object.assign(new Error('Funcionário não encontrado.'), { status: 404 });
    const [r] = await pool.execute(
      'INSERT INTO node_folha_lancamentos (empresa, funcionario, competencia, tipo, descricao, valor, criado_por) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [Number(req.auth.companyId), data.employeeId, data.competencia, data.tipo, data.descricao, data.valor, Number(req.auth.sub)]
    );
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'criar', entity: 'folha_lancamento', entityId: r.insertId });
    res.status(201).json({ id: r.insertId });
  } catch (error) { next(error); }
});
router.delete('/payroll/entries/:id', authorize('Administrador', 'Gerente'), async (req, res, next) => {
  try {
    const entryId = id.parse(req.params.id);
    const [r] = await pool.execute('DELETE FROM node_folha_lancamentos WHERE id = ? AND empresa = ?', [entryId, Number(req.auth.companyId)]);
    if (!r.affectedRows) throw Object.assign(new Error('Lançamento não encontrado.'), { status: 404 });
    await audit(pool, { companyId: Number(req.auth.companyId), userId: Number(req.auth.sub), action: 'excluir', entity: 'folha_lancamento', entityId: entryId });
    res.status(204).end();
  } catch (error) { next(error); }
});

module.exports = router;
