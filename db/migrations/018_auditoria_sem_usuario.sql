-- Auditoria de ação automática: `usuario` passa a aceitar NULL.
--
-- Toda linha de auditoria pressupunha um usuário logado, o que valia enquanto só havia ação humana.
-- A confirmação de pagamento por webhook não tem usuário — quem agiu foi o provedor — e a
-- restrição NOT NULL fazia a transação inteira falhar: a mensalidade não era quitada e o provedor
-- recebia 500, reenviando o aviso em laço.
--
-- NULL aqui significa "sistema", e é mais honesto que inventar um usuário fictício: o `detalhes`
-- de cada registro já diz a origem (por exemplo `{"origem": "webhook:Mercado Pago"}`).

ALTER TABLE node_audit_log ALTER COLUMN usuario DROP NOT NULL;
