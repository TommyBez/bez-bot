// Serves a local production build: the built eve runtime plus `next start`.
// withEve proxies /eve/v1/** to 127.0.0.1:$EVE_NEXT_PRODUCTION_PORT (4274 by
// default). This starts that server when nothing is listening there yet, so the
// app works whether or not Next.js spawns it. Vercel doesn't use this script.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const port = Number.parseInt(process.env.EVE_NEXT_PRODUCTION_PORT ?? "4274", 10);
const children = [];

function isListening() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function run(command, args, env = {}) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => {
    for (const other of children) if (other !== child) other.kill();
    process.exit(code ?? 0);
  });
  return child;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
  });
}

if (!(await isListening())) {
  const entry = join(root, ".output", "server", "index.mjs");
  if (!existsSync(entry)) {
    console.error("Missing .output/server/index.mjs. Run `pnpm build` first.");
    process.exit(1);
  }
  const p = String(port);
  run(process.execPath, [entry], { NODE_ENV: "production", HOST: "127.0.0.1", NITRO_HOST: "127.0.0.1", PORT: p, NITRO_PORT: p });
  for (let i = 0; i < 100 && !(await isListening()); i++) await new Promise((r) => setTimeout(r, 100));
}

run("next", ["start", "apps/web", ...process.argv.slice(2)]);
