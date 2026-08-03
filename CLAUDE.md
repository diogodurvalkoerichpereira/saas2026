# Instruções do projeto — saas2026

## Fluxo de Git (preferência explícita do dono do repositório)

- **Sempre trabalhar e commitar direto na branch `main`.**
- **Sempre salvar no git — commit E push — sem precisar pedir.** Ao terminar cada peça de trabalho
  que funcione e esteja verificada, commitar e dar `git push -u origin main` na hora. Não acumular
  trabalho pronto sem commit, não esperar o fim da conversa, não perguntar "quer que eu commite?".
  O ambiente desta sessão é efêmero: o que não foi enviado se perde quando o contêiner é reciclado.
- **Nunca criar branches novas** (nem `claude/*`, nem de feature) — mesmo que o fluxo padrão de tarefas automatizadas sugira uma branch dedicada.
- **Nunca abrir Pull Request** a menos que explicitamente solicitado.
- Se uma sessão automatizada já tiver criado/aberto uma branch antes desta instrução ser lida, mesclar (fast-forward) o resultado direto em `main` e continuar o trabalho local em `main`.
- Esta é uma instrução permanente do usuário (dono do repositório, e-mail associado à conta GitHub `diogodurvalkoerichpereira`) — não pedir confirmação novamente para push em `main` neste repositório.

## Banco de dados — PostgreSQL com camada de compatibilidade

O projeto migrou de MySQL para PostgreSQL. `src/config/database.js` é um **shim**: envolve o driver
`pg` mas preserva a superfície do `mysql2` que o resto do código usa — placeholders `?`, retorno em
tupla `[rows, fields]`, `insertId` e `affectedRows`.

Consequências ao escrever código novo:

- **Continue usando `?`**, não `$1`. O shim traduz, respeitando literais e comentários.
- `const [rows] = await pool.execute(...)` para leitura; `const [result] = await ...` e
  `result.insertId` / `result.affectedRows` para escrita. O shim anexa `RETURNING id` sozinho.
- Um parâmetro que seja **array** expande para lista de placeholders (`IN (?)` funciona).
- Isto é dívida técnica consciente, para preservar a suíte de testes durante a migração. Dá para
  migrar módulo a módulo para `pg` nativo depois, com os testes verdes.

Armadilhas do PostgreSQL que já custaram caro aqui:

- **Alias camelCase precisa de aspas**: `AS "unitPrice"`. Sem aspas o Postgres rebaixa para
  `unitprice`, o JS lê `undefined`, vira `NaN` — e `numeric` **aceita NaN em silêncio**.
- **Parâmetro nu em função polimórfica** (`CONCAT`, `NULLIF`) precisa de cast: `?::text`.
- `EXTRACT(...)` devolve `numeric`; use `::int` quando o valor virar chave de `Map`.
- Schema é `db/001-schema.sql` (fonte única). `db/002-seed-test.sql` **nunca** vai para produção.
