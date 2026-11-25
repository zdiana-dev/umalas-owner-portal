# Деплой на Coolify

Проект живёт одновременно в двух местах: его продолжает собирать и публиковать Lovable,
и параллельно он собирается на Coolify из того же репозитория GitLab. Ниже — как это
устроено и что нужно нажать в Coolify.

## Почему нельзя просто «собрать и задеплоить»

Шаблон Lovable здесь — не обычный Vite SPA, а **TanStack Start с SSR**: сборкой занимается
nitro, и `@lovable.dev/vite-tanstack-config` по умолчанию целится в **Cloudflare Workers**
(`preset: cloudflare-module`). На выходе получается воркер, а не сервер, который можно
запустить в контейнере. Плюс две вещи, которые ломают сборку на стороннем хостинге:

1. **Ассеты не лежат в репозитории.** В `src/assets/` вместо картинок находятся указатели
   `*.asset.json` с путями вида `/__l5e/assets-v1/<id>/<file>` — сами файлы хранятся на CDN
   Lovable. Внутри Lovable этот путь обслуживает их прокси, снаружи он даёт 404.
2. **`VITE_*` вшиваются на этапе сборки.** Задать их в рантайме контейнера уже нельзя.

## Как это решено

Ничего из того, что генерирует Lovable, не изменено — `vite.config.ts`, `package.json`
и `src/` остались нетронутыми, поэтому Lovable может свободно их перезаписывать.
Добавлены только файлы, которых он не касается:

| Файл | Зачем |
| --- | --- |
| `Dockerfile` | Отдельный конвейер сборки для Coolify |
| `.dockerignore` | Чтобы в контекст сборки не попадали `node_modules`, `.output`, `dist` |
| `scripts/fetch-lovable-assets.mjs` | Скачивает картинки с CDN Lovable в `public/` |
| `public/__l5e/` | Скачанные копии картинок (коммитятся, чтобы сборка шла и без сети) |

### Переключение nitro на Node

Сам `@lovable.dev/vite-tanstack-config` умеет и то, и другое — важно только, кто спрашивает:

- **Сборка внутри Lovable** (`LOVABLE_SANDBOX=1`): preset жёстко выставляется в
  `cloudflare-module`, а переменная `NITRO_PRESET` явно игнорируется — в логе видно
  `Ignoring NITRO_PRESET inside the Lovable build environment`. Результат кладётся в `dist/`.
- **Сборка снаружи** (Coolify, локальная машина): `NITRO_PRESET` побеждает. `Dockerfile`
  выставляет `NITRO_PRESET=node-server`, и на выходе получается самодостаточный
  Node-сервер в `.output/`, запускаемый как `node .output/server/index.mjs`.

То есть один и тот же `vite.config.ts` обслуживает оба сценария, и правки Lovable
не могут сломать сборку Coolify.

### Картинки

`scripts/fetch-lovable-assets.mjs` читает все `src/assets/**/*.asset.json` и скачивает
файлы в `public/` **по тем же путям** `/__l5e/assets-v1/...`. Благодаря этому код
приложения менять не нужно: ссылки остаются прежними и работают и на Lovable, и на Coolify.

Скрипт запускается в `Dockerfile` при каждой сборке, поэтому новая картинка, загруженная
в Lovable, подтянется автоматически. Если CDN недоступен, а копия уже лежит в репозитории —
берётся она; сборка падает только когда копии нет вовсе.

Запустить вручную:

```sh
node scripts/fetch-lovable-assets.mjs
```

Источник переопределяется переменной `LOVABLE_ASSET_ORIGIN`
(по умолчанию `https://umalas-owner.lovable.app`).

## Что уже заведено в Coolify

Инстанс: <https://coolify.magnumestate.com> (сервер `localhost`, 15.235.224.186, прокси Traefik).

| Параметр | Значение |
| --- | --- |
| Проект | `Umalas Owner Portal` — `zrdn6bld6uoimttbzpwoityq` |
| Окружение | `production` — `r5nqa2mhpf13lms4l3wkvayf` |
| Приложение | `umalas-owner-portal` — `e17dvvtfvn8zxb6jn8bzc7id` |
| Источник | `git@gitlab.com:magnum-apps/umalas-owner.git`, ветка `main` |
| Build Pack | `dockerfile`, `/Dockerfile`, base directory `/` |
| Порт | `3000` |
| Домен | `https://clients.theumalas.com` (сертификат Traefik выпустит сам) |
| Health check | GET `/` на порту 3000 |
| Deploy key | `umalas-owner-deploy` — `t2cctqgqwn7f3nps5w63t35j` |

Переменные окружения задавать не нужно: `VITE_*` берутся из закоммиченного `.env`
(это публичные `publishable`-ключи Supabase, не секреты). Если понадобится другой проект
Supabase — добавить в Coolify как **Build Variable**, не runtime: они читаются только при сборке.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Что нужно добавить в GitLab

### 1. Deploy key (без него Coolify не склонирует репозиторий)

*Settings → Repository → Deploy keys → Add new key*, доступ **только на чтение**:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEjf76dbN7exNtsr8JZ92Zm3kUpyUp5r9h1YvGB8Nu7M coolify-deploy@umalas-owner
```

Пара сгенерирована специально для этого репозитория (существующие ключи Coolify выданы
на группу `magnumestategit`, а этот проект живёт в `magnum-apps`). Приватная часть
загружена в Coolify и больше нигде не хранится — временная копия удалена.

### 2. Вебхук для автодеплоя

*Settings → Webhooks → Add new webhook*

- URL: `https://coolify.magnumestate.com/webhooks/source/gitlab/events/manual`
- Secret token: из Coolify, страница приложения → вкладка **Webhooks** → *GitLab*
- Trigger: **Push events**, ветка `main`
- SSL verification: включена

После этого цепочка замыкается: правка в Lovable → коммит в `main` → вебхук → пересборка
на Coolify. Новые картинки, загруженные в Lovable, подтянутся автоматически, потому что
`scripts/fetch-lovable-assets.mjs` запускается при каждой сборке.

> Lovable синхронизируется с `main` в обе стороны, поэтому **нельзя переписывать
> опубликованную историю** — никаких force-push, rebase и amend уже отправленных коммитов
> (см. `AGENTS.md`). Правки для Coolify вносятся обычными коммитами поверх.

## Supabase

Supabase — внешний managed-проект (`mxzduseebqzhshsocrcd`), он не переезжает вместе с
приложением и ничего дополнительного на стороне Coolify не требует: запросы идут из браузера
и из SSR напрямую на `*.supabase.co`, CORS там открыт (`access-control-allow-origin: *`),
а доступ ограничивают RLS-политики и JWT пользователя, а не источник запроса.
Ключ в бандле — `publishable`, он и рассчитан на публичность.

Одно место требует внимания при смене домена. Вход по магической ссылке и подтверждение
регистрации передают `emailRedirectTo: window.location.origin` (`src/routes/index.tsx`),
то есть теперь `https://clients.theumalas.com`. Supabase сверяет этот адрес со списком разрешённых и,
не найдя совпадения, уводит пользователя на Site URL — то есть обратно на домен Lovable.
Поэтому в панели Supabase → **Authentication → URL Configuration** нужно добавить в
*Redirect URLs*:

```
https://clients.theumalas.com/**
```

Домен Lovable из списка убирать не нужно — оба должны работать параллельно.
Вход по паролю от этой настройки не зависит и работает сразу.

Приватные бакеты Storage и подписанные ссылки тоже никак не привязаны к домену приложения.

## Серверные переменные окружения

Часть кода, который генерирует Lovable, ходит в Supabase **с сервера**, а не из браузера,
и читает переменные через `process.env` в рантайме — в отличие от `VITE_*`, которые
вшиваются при сборке. Нужны три:

| Переменная | Кто читает | Откуда берётся |
| --- | --- | --- |
| `SUPABASE_URL` | `auth-middleware.ts`, `client.server.ts` | из `.env` в образе |
| `SUPABASE_PUBLISHABLE_KEY` | `auth-middleware.ts` | из `.env` в образе |
| `SUPABASE_SERVICE_ROLE_KEY` | `client.server.ts` | **недоступна, см. ниже** |

Первые две решены в `Dockerfile`: закоммиченный `.env` копируется в рантайм-образ, а сервер
стартует как `node --env-file-if-exists=.env`. Так значения остаются синхронными с тем, что
коммитит Lovable, и настраивать их в Coolify не нужно. Переменные, заданные в Coolify,
перебивают файл — то есть staging-проект Supabase по-прежнему можно подключить оттуда.

### Чего не хватает: service role

`client.server.ts` создаёт клиент с **service role key** — он обходит все RLS-политики.
Lovable в git его не коммитит (и правильно делает), а подставляет из секретов Lovable Cloud.
Забрать этот ключ из Lovable Cloud нельзя: managed-бэкенд не выдаёт connection credentials
ни в UI, ни через API — в разделе Secrets виден только `LOVABLE_API_KEY`.

Поэтому на Coolify не работает всё, что идёт через `supabaseAdmin`:

- скачивание документов, отчётов и квитанций (`src/lib/files.functions.ts`) — signed URL
  на приватные бакеты выдаётся привилегированным клиентом, потому что единственная
  storage-политика (`storage_admin_read`) разрешает читать бакеты только админам;
- админские операции: `admin.functions.ts`, `payouts.functions.ts`,
  `purchase-extract.functions.ts`.

Всё остальное — вход, дашборд, таблицы отчётов, любые запросы под RLS — работает,
потому что идёт через publishable-ключ.

Развязать это можно двумя способами: перенести привилегированные операции в Edge Functions
Lovable Cloud (там service role доступен изнутри, а фронт вызывает их по HTTP с JWT
пользователя) либо переехать на собственный проект Supabase. Второй вариант даёт полный
контроль над ключами, но Lovable Cloud нельзя переключить на внешний Supabase —
это отдельная миграция.

## Локальная проверка сборки

```sh
bun install
node scripts/fetch-lovable-assets.mjs
NITRO_PRESET=node-server bun run build
PORT=3000 node .output/server/index.mjs
```

Проверить, что собралось именно под Node, можно по `.output/nitro.json` —
там должно быть `"preset": "node-server"`.
