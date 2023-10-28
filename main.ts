import { Application, Router } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import nunjucks from "npm:nunjucks";

import { extname } from "https://deno.land/std@0.188.0/path/win32.ts";
import { EmbeddedLoader } from "./embeddedLoader.ts";
import embeddedFiles, { getFile } from "./embedded.ts";
const minifiedCss = embeddedFiles["styles/out.css"].text();

const LIST_LIMIT = 10;

console.log("Welcome to KvViewer!");
console.log("Configuration:");
console.log("\tport: Using the PORT environment variable. Defaults to 8000.");
console.log(
  "\tkv path: Using the DENO_KV_PATH environment variable.",
);
console.log(
  "\tkv access token: Using the DENO_KV_ACCESS_TOKEN environment variable.",
);
console.log("");

const kv = await Deno.openKv(Deno.env.get("DENO_KV_PATH"));

interface AppState {
  //@ts-ignore-next-line: Required for compilation
  nj: nunjucks.Environment;
}

const app = new Application<AppState>();
const router = new Router<AppState>();

app.use(async (_ctx, next) => {
  try {
    await next();
  } catch (e) {
    console.log("Error");
    console.error(e);
  }
});

app.use(async (ctx, next) => {
  const nj = ctx.state.nj = new nunjucks.Environment(
    // TODO: Replace this with leaf loader
    // new nunjucks.FileSystemLoader("./views"),
    new EmbeddedLoader(),
    {
      trimBlocks: true,
      // noCache: true,
    },
  );

  nj.addGlobal("minifiedStyles", `<style>${minifiedCss}</style>`);
  nj.addGlobal("LIST_LIMIT", LIST_LIMIT);
  // nj.addGlobal("minifiedJs", minifiedJs.text());

  await next();
});

router.get("/", async (ctx) => {
  ctx.response.body = await ctx.state.nj.render("home.njk", {});
});

async function runListQuery(
  prefix: Deno.KvKey,
  cursor?: string,
): Promise<{ items: unknown[]; currentCursor?: string; nextCursor?: string }> {
  const res = kv.list({ prefix }, { limit: LIST_LIMIT, cursor });

  const items = [];
  for await (const itm of res) {
    items.push(itm);
  }

  if (items.length === 0 && cursor) {
    return await runListQuery(prefix);
  }

  return { items, currentCursor: cursor, nextCursor: res.cursor };
}

function listUrlFromOptions(
  { prefix, nextCursor, currentCursor }: {
    prefix?: Deno.KvKey;
    currentCursor?: string | null;
    nextCursor?: string | null;
  },
) {
  const sp = new URLSearchParams();
  sp.set("prefix", JSON.stringify(prefix));
  if (prefix && currentCursor) sp.set("cursor", currentCursor as string);
  if (prefix && nextCursor) sp.set("nextCursor", nextCursor as string);

  return "/list?" + sp.toString();
}

router.get("/list", async (ctx) => {
  let items, prefix, cursor, nextCursor, currentCursor;
  try {
    prefix = JSON.parse(ctx.request.url.searchParams.get("prefix") as string);
    cursor = ctx.request.url.searchParams.get("cursor");
  } catch (_e) {
    prefix = false;
  }

  if (prefix) {
    const res = await runListQuery(
      prefix,
      cursor ? cursor : undefined,
    );
    items = res.items;
    nextCursor = res.nextCursor;
    currentCursor = res.currentCursor;
  } else {
    items = false;
  }

  ctx.response.headers.set(
    "HX-Replace-Url",
    listUrlFromOptions({ prefix, currentCursor, nextCursor }),
  );
  ctx.response.body = await ctx.state.nj.render("list.njk", {
    items,
    prefix,
    nextCursor,
    nextCursorUrl: listUrlFromOptions({ prefix, currentCursor: nextCursor }),
  });
});

router.post("/list/items", async (ctx) => {
  let items, prefix, nextCursor, currentCursor;
  try {
    const body = await ctx.request.body({ type: "form" }).value;
    const prefixStr = body.get("prefix") as string;
    prefix = JSON.parse(prefixStr);
  } catch (_) {
    prefix = false;
  }

  if (prefix) {
    const res = await runListQuery(
      prefix,
    );
    items = res.items;
    currentCursor = res.currentCursor;
    nextCursor = res.nextCursor;
  } else {
    items = false;
  }

  ctx.response.headers.set(
    "HX-Push-Url",
    listUrlFromOptions({ prefix, currentCursor, nextCursor }),
  );
  ctx.response.body = await ctx.state.nj.render("list-results.njk", {
    items,
    currentCursor,
    nextCursor,
    nextCursorUrl: listUrlFromOptions({ prefix, currentCursor: nextCursor }),
  });
});

router.get("/get", async (ctx) => {
  let results, key;
  try {
    key = JSON.parse(ctx.request.url.searchParams.get("q") as string);
  } catch (_) {
    key = false;
  }
  if (key) {
    results = await kv.get(key);
  } else {
    results = false;
  }

  ctx.response.body = await ctx.state.nj.render("get.njk", {
    results,
    currentQuery: key ? JSON.stringify(key) : false,
  });
});

router.post("/get/item", async (ctx) => {
  let item, key;
  try {
    const body = await ctx.request.body({ type: "form" }).value;
    const keyStr = body.get("key") as string;
    key = JSON.parse(keyStr);
  } catch (_) {
    key = false;
  }

  if (key) item = await kv.get(key, {});
  else item = false;

  ctx.response.headers.set(
    "HX-Push-Url",
    "/get/?q=" + encodeURIComponent(JSON.stringify(key)),
  );
  ctx.response.body = await ctx.state.nj.render("item.njk", { item });
});

router.delete("/item", async (ctx, next) => {
  let key;
  try {
    key = JSON.parse(ctx.request.url.searchParams.get("key") || "");
  } catch (_) {
    return await next();
  }

  await kv.delete(key);

  ctx.response.body = await ctx.state.nj.render("get.njk", {
    results: {},
    currentQuery: JSON.stringify(key),
  });
});

app.use(router.routes());

app.use(async (ctx, next) => {
  if (!ctx.request.url.pathname.startsWith("/static")) {
    await next();
    return;
  }

  const filePath = ctx.request.url.pathname.slice(1);
  const res = getFile(filePath);
  if (!res) return await next();

  const ct = {
    ".svg": "image/svg+xml",
    ".css": "text/css",
    ".js": "application/javascript",
  }[extname(filePath)];

  ctx.response.headers.set("Content-Type", ct || "text/plain");
  ctx.response.body = res.bytes();
});

app.use(async (ctx) => {
  ctx.response.status = 404;
  ctx.response.body = await ctx.state.nj.render("error404.njk", {});
});

const PORT = ((p) => isNaN(p) ? 8000 : p)(
  parseInt(Deno.env.get("PORT") || "8000"),
);
console.log("KvViewer is running on port: " + PORT);
await app.listen({
  port: PORT,
});
