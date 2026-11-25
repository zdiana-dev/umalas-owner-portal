#!/usr/bin/env node
/**
 * Вендорит изображения Lovable в public/ перед сборкой вне Lovable (Coolify, локально).
 *
 * Lovable держит загруженные картинки на своём CDN, а в репозиторий кладёт только
 * указатели src/assets/<name>.asset.json с путём вида /__l5e/assets-v1/<id>/<file>.
 * Внутри Lovable этот путь обслуживает их прокси; на любом другом хостинге он даёт 404.
 * Скрипт скачивает файлы по тем же путям в public/, поэтому менять код приложения
 * не нужно — ссылки остаются прежними и продолжают работать и там, и там.
 *
 * Файлы коммитятся в репозиторий, так что сборка проходит и без сети: если скачать
 * не удалось, а копия уже лежит на диске, берём её. Падаем только когда копии нет.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS_DIR = path.join(ROOT, "src", "assets");
const PUBLIC_DIR = path.join(ROOT, "public");
const ORIGIN = (process.env.LOVABLE_ASSET_ORIGIN || "https://umalas-owner.lovable.app").replace(/\/+$/, "");

async function readPointers() {
  const entries = await readdir(ASSETS_DIR, { withFileTypes: true, recursive: true });
  const pointers = new Map(); // url -> { url, size, source }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".asset.json")) continue;
    const file = path.join(entry.parentPath ?? ASSETS_DIR, entry.name);
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (typeof parsed.url !== "string" || !parsed.url.startsWith("/__l5e/")) {
      console.warn(`[assets] пропускаю ${path.relative(ROOT, file)}: нет пути /__l5e/`);
      continue;
    }
    // Несколько указателей могут ссылаться на один и тот же asset_id — качаем один раз.
    if (!pointers.has(parsed.url)) {
      pointers.set(parsed.url, { url: parsed.url, size: parsed.size, source: path.relative(ROOT, file) });
    }
  }
  return [...pointers.values()];
}

async function sizeOnDisk(file) {
  try {
    return (await stat(file)).size;
  } catch {
    return null;
  }
}

async function download(url) {
  const response = await fetch(`${ORIGIN}${url}`, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0) throw new Error("пустой ответ");
  // Прокси Lovable отдаёт HTML-страницу вместо 404, если ассет удалён.
  if (body.subarray(0, 15).toString("latin1").trimStart().toLowerCase().startsWith("<!doctype")) {
    throw new Error("вместо файла пришёл HTML — ассет недоступен");
  }
  return body;
}

const pointers = await readPointers();
if (pointers.length === 0) {
  console.log("[assets] указателей *.asset.json нет — нечего делать");
  process.exit(0);
}

console.log(`[assets] источник ${ORIGIN}, указателей: ${pointers.length}`);
let downloaded = 0;
let cached = 0;
const missing = [];

for (const pointer of pointers) {
  const dest = path.join(PUBLIC_DIR, pointer.url);
  const onDisk = await sizeOnDisk(dest);

  // Размер из указателя — единственная метаданная, по которой видно смену картинки.
  if (onDisk !== null && (pointer.size == null || onDisk === pointer.size)) {
    cached += 1;
    continue;
  }

  try {
    const body = await download(pointer.url);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, body);
    downloaded += 1;
    const sha = createHash("sha256").update(body).digest("hex").slice(0, 12);
    console.log(`[assets] ↓ ${pointer.url} (${body.length} Б, sha256:${sha})`);
  } catch (error) {
    if (onDisk !== null) {
      console.warn(`[assets] ! ${pointer.url}: ${error.message} — оставляю копию из репозитория`);
      cached += 1;
      continue;
    }
    missing.push(`${pointer.url} (из ${pointer.source}): ${error.message}`);
  }
}

if (missing.length > 0) {
  console.error(
    `[assets] не удалось получить ${missing.length} ассет(ов), и копий в public/ тоже нет:\n  ` +
      missing.join("\n  ") +
      `\n  Проверьте доступность ${ORIGIN} или задайте LOVABLE_ASSET_ORIGIN.`,
  );
  process.exit(1);
}

console.log(`[assets] готово: скачано ${downloaded}, из репозитория ${cached}`);
