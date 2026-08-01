# Deploy no Coolify

Guia da primeira subida do saas2026 numa VPS com Coolify. Depois da primeira vez, deploy é só
`git push` (com Automatic Deployment ligado) — exceto quando houver migração de banco.

## 1. Criar o banco antes da aplicação

No painel: **+ New → Database → PostgreSQL 16**.

Anote a string de conexão que o Coolify gera. Ela tem a forma
`postgres://usuario:senha@host:5432/banco`.

> A aplicação aceita tanto `DATABASE_URL` quanto as cinco variáveis separadas. Prefira a URL: é uma
> linha só e elimina erro de digitação.

## 2. Criar a aplicação

**+ New → Application → Public/Private Repository**

| Campo | Valor |
|---|---|
| Repository URL | `https://github.com/diogodurvalkoerichpereira/saas2026` |
| Branch | `main` |
| Build Pack | `Dockerfile` |
| Base Directory | *(vazio)* |
| Port | `3000` |

## 3. Variáveis de ambiente

```
DATABASE_URL=postgres://usuario:senha@host:5432/banco   ← copiada do passo 1
JWT_SECRET=<gere o seu, ver abaixo>
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://seu-dominio.com.br
TZ=America/Sao_Paulo
```

Gere o `JWT_SECRET` você mesmo e **não reaproveite** o de teste:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Se o Postgres for gerenciado (fora do Coolify) e exigir TLS, acrescente `DATABASE_SSL=true`.

Só preencha as chaves de Asaas, WhatsApp e fiscal quando for de fato usar esses módulos —
`JOBS_ENABLED` e `WHATSAPP_DISPATCH_ENABLED` ficam `false` até lá.

## 4. Volume persistente — não pule

**Storages → Add volume:** destino `/app/uploads`.

É onde ficam certificados digitais A1 e anexos. Sem o volume, **tudo é apagado a cada deploy** —
inclusive o certificado usado para emitir nota fiscal.

## 5. Aplicar o schema (uma vez só)

O Coolify **não executa** `docker-entrypoint-initdb.d`, então o schema não é criado sozinho. Faça
o primeiro deploy e, com o container no ar, abra o terminal dele (**Execute Command**):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/001-schema.sql
```

O `psql` já vem na imagem. Confira o resultado:

```bash
psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# deve responder 73
```

> **Nunca rode `db/002-seed-test.sql` em produção.** Ele cria usuários de teste com senha conhecida
> (`Teste@2026`). Serve só para desenvolvimento.

Como o banco nasce vazio, crie a primeira empresa e o primeiro usuário administrador direto pelo
`psql`, com uma senha bcrypt gerada por você:

```bash
node -e "console.log(require('bcryptjs').hashSync('SUA_SENHA_FORTE', 12))"
```

## 6. Deploy

Botão **Deploy**. Acompanhe os logs até `API iniciada na porta 3000`.

Verifique:

```
https://seu-dominio.com.br/api/health   →   {"status":"ok","database":"connected"}
```

A imagem também tem `HEALTHCHECK` embutido, então o próprio Docker marca o container como
*unhealthy* se o banco cair.

## 7. Deploy automático

Em **Settings**, ative **Automatic Deployment**. A partir daí, `git push` na `main` dispara o
redeploy sozinho.

---

## Redeploys seguintes

Só `git push`. As exceções:

- **Mudou dependência** (`package.json`): nada a fazer, o `npm ci` roda no build.
- **Mudou o schema**: aplique a migração nova pelo terminal do container, na ordem, **antes** de o
  código que depende dela entrar no ar. Migrações incrementais ficam em `db/migrations/`.
- **Mudou `TZ` ou variável de ambiente**: exige restart, não só rebuild.

## Se algo falhar

| Sintoma | Causa provável |
|---|---|
| `/api/health` responde 503 | `DATABASE_URL` errada, ou o banco não está na mesma rede interna do Coolify |
| `relation "usuarios" does not exist` | o passo 5 não foi feito |
| Login falha com a senha certa | nenhum usuário criado ainda (banco vazio) |
| Uploads somem a cada deploy | falta o volume do passo 4 |
| Datas com um dia de diferença | `TZ` não definido — o container fica em UTC |

## Nota sobre o driver

`src/config/database.js` é uma camada de compatibilidade sobre o `pg` que preserva a superfície do
`mysql2` (placeholders `?`, tupla `[rows, fields]`, `insertId`). Não é acidente — está documentado
em `CLAUDE.md`, junto das armadilhas de PostgreSQL que já custaram caro neste projeto.
