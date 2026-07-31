async function audit(db, { companyId, userId, action, entity, entityId, reason = null, details = null }) {
  await db.execute(
    `INSERT INTO node_audit_log
      (empresa, usuario, acao, entidade, entidade_id, motivo, detalhes, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, CURRENT_TIMESTAMP)`,
    [companyId, userId, action, entity, entityId, reason, details ? JSON.stringify(details) : null]
  );
}

module.exports = { audit };
