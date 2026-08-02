-- Enterprise é ilimitado: usa 0 nos limites (o backend trata 0 como sem limite e a tela mostra
-- "Ilimitado"). Corrige as instalações onde a 005 gravou números altos (99999/999/99).
UPDATE planos SET clientes = 0, usuarios = 0, dispositivos = 0 WHERE nome = 'Enterprise';
