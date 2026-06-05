import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "3115", 10);
const dbDir = path.join(repoRoot, ".tmp-tests");
const dbPath = path.join(dbDir, "manual-editor-e2e-runtime.db");

fs.mkdirSync(dbDir, { recursive: true });
for (const suffix of ["", "-journal", "-shm", "-wal"]) {
  fs.rmSync(`${dbPath}${suffix}`, { force: true });
}

const child = spawn(
  "node",
  ["./node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      NODE_ENV: "test",
      BLOB_READ_WRITE_TOKEN: "",
    },
    stdio: "inherit",
  },
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
