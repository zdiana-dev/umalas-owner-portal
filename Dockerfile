# syntax=docker/dockerfile:1

# Сборка для Coolify. Lovable этот файл не использует — он собирает проект своим
# конвейером (nitro + preset cloudflare-module, жёстко зашитый в @lovable.dev/vite-tanstack-config
# при LOVABLE_SANDBOX=1). Здесь мы, наоборот, снаружи Lovable переключаем nitro на обычный
# Node-сервер через NITRO_PRESET — конфиг это поддерживает и vite.config.ts трогать не нужно,
# поэтому Lovable может свободно перезаписывать его при своих правках.

# ─────────────────────────── Сборка ───────────────────────────
FROM oven/bun:1-alpine AS build
WORKDIR /app

# Зависимости отдельным слоем: пересобираются только при изменении лок-файла.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

# Картинки Lovable лежат на их CDN, в репозитории только указатели *.asset.json.
# Скрипт кладёт копии в public/ по тем же путям; см. scripts/fetch-lovable-assets.mjs.
ARG LOVABLE_ASSET_ORIGIN=https://umalas-owner.lovable.app
RUN LOVABLE_ASSET_ORIGIN="$LOVABLE_ASSET_ORIGIN" bun run scripts/fetch-lovable-assets.mjs

# VITE_* вшиваются в клиентский бандл на этапе сборки, задать их в рантайме уже нельзя.
# Значения по умолчанию берутся из закоммиченного .env; build args нужны, только если
# сборка должна смотреть на другой проект Supabase (например, staging).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
RUN : > .env.production.local; \
    for var in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY VITE_SUPABASE_PROJECT_ID; do \
      eval "value=\${$var:-}"; \
      if [ -n "$value" ]; then echo "$var=$value" >> .env.production.local; fi; \
    done

# Ключевая строка: уводит nitro с Cloudflare Workers на самостоятельный Node-сервер.
ENV NITRO_PRESET=node-server
RUN bun run build

# Lovable коммитит .env всегда, но COPY не должен падать, если он вдруг исчезнет.
RUN touch .env

# ─────────────────────────── Рантайм ───────────────────────────
# .output самодостаточен (внутри только tslib, нативных модулей нет), поэтому
# node_modules в финальный образ не переносим.
FROM node:24-alpine AS runtime
WORKDIR /app

# Coolify проверяет здоровье контейнера снаружи и умеет только curl/wget —
# в node:24-alpine нет ни того, ни другого, без curl деплой откатывается как unhealthy.
RUN apk add --no-cache curl

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build --chown=node:node /app/.output ./.output

# Серверный код читает SUPABASE_URL и SUPABASE_PUBLISHABLE_KEY через process.env
# в рантайме (см. src/integrations/supabase/auth-middleware.ts) — в отличие от VITE_*,
# которые вшиваются при сборке. Значения лежат в закоммиченном .env, поэтому кладём его
# в образ: так они остаются синхронными с тем, что коммитит Lovable, и настраивать
# ничего вручную не нужно. Переменные, заданные в Coolify, перебивают файл.
COPY --from=build --chown=node:node /app/.env ./.env

USER node
EXPOSE 3000

# Именно 127.0.0.1, а не localhost: сервер слушает только IPv4, а localhost в образе
# резолвится ещё и в ::1, откуда проверка возвращает connection refused.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/" -o /dev/null || exit 1

CMD ["node", "--env-file-if-exists=.env", ".output/server/index.mjs"]
