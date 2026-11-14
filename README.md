# Prumo

Aplicativo de gestão financeira pessoal. Especificação em `docs/especificacao_aplicativo_gestao_financeira_pessoal.md`.

| Pasta | O que é |
|---|---|
| `app/` | App React Native (Expo) |
| `src/modules/core` | API financeira (Express + Prisma) — porta 3000, prefixo `/api/v1` |
| `src/modules/message` | Microserviço de notificações (BullMQ + Redis) — porta 3001, prefixo `/message/v1` |
| `src/shared` | Config, banco, Redis/fila, erros, middlewares usados pelos dois serviços |
| `src/prisma` | `schema.prisma`, migrations e seed |
| `docs/api/bruno` | Coleção Bruno para validar cada entrega |
| `scripts/smoke` | Smoke tests por entrega (`npm run smoke:eN`) |

Camadas do core: `routes → controllers → models (Prisma + Zod) → services (regras de negócio)`.

## Rodando o backend (Node 22+)

Precisa de um Postgres 16 e um Redis 7 acessíveis (hoje: containers no WSL, portas 5432 e 6379).

1. **Credenciais:** preencha `DB_*` e `REDIS_*` no `.env` (modelo em `.env.example`). No Windows use `127.0.0.1` como host: com `localhost` o Prisma tenta IPv6 e não conecta.
2. **Preparar o ambiente (uma vez; pode repetir sem problema):**
   ```bash
   npm install
   npm run bootstrap   # gera o Prisma Client, confere o Redis, cria o banco se não existir, aplica as migrations e roda as seeds
   ```
3. **Subir todos os serviços do backend:** `npm run dev` (core :3000 e message :3001, com reload). Individualmente: `npm run dev:core` / `npm run dev:message`.
4. **Validar a entrega:** `npm run typecheck && npm test`, depois `npm run smoke:e0` com os serviços no ar, ou importe `docs/api/bruno` no Bruno (ambiente `local`).

Sem Postgres/Redis próprios, `npm run docker:up` sobe os dois (e o Mailpit, para e-mail de desenvolvimento) pelo `docker-compose.yml`, usando as credenciais do `.env`.

**Filas:** o core publica eventos no Redis via BullMQ (prefixo `prumo`, para não colidir com outros projetos no mesmo Redis) e o serviço message consome.

## Entregas

E0 Fundação · E1 Conta e acesso · E2 Serviço de mensagens · E3 Núcleo financeiro · E4 Dashboard e relatórios · E5 Cartões e faturas · E6 Recorrências e calendário · E7 Dívidas e consórcios · E8 Investimentos · E9 Planejamento e visão integrada · E10 Endurecimento e deploy · E11 Integração do app.
