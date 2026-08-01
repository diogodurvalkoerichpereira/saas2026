FROM node:22-alpine

# tzdata: sem ele o TZ é ignorado e o container fica em UTC — num ERP brasileiro isso joga toda
# venda feita após as 21h para o dia seguinte, porque CURRENT_DATE resolve no fuso da sessão.
# postgresql-client: o Coolify não executa docker-entrypoint-initdb.d, então o schema é aplicado
# de dentro do container na primeira subida (ver DEPLOY-COOLIFY.md).
RUN apk add --no-cache tzdata postgresql-client
ENV TZ=America/Sao_Paulo

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY public ./public
COPY src ./src
COPY db ./db

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "src/server.js"]
