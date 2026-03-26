import { spawn } from "node:child_process";
import net from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..");
const nextBin = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");

const routes = ["/", "/menu", "/editor", "/editor-next", "/csv", "/tracking", "/notice"];
const host = "127.0.0.1";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not determine open port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(baseUrl, { redirect: "follow" });
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting up.
    }
    await delay(500);
  }
  throw new Error("Timed out waiting for Next.js production server to start.");
}

async function smokeRoutes(baseUrl) {
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "follow" });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      throw new Error(`Smoke check failed for ${route}: expected 2xx but received ${response.status}`);
    }
    if (!contentType.includes("text/html")) {
      throw new Error(`Smoke check failed for ${route}: expected text/html but received ${contentType || "unknown"}`);
    }
    console.log(`Smoke OK: ${route} (${response.status})`);
  }
}

async function main() {
  if (!existsSync(nextBin)) {
    throw new Error("Next.js binary is missing. Run npm ci before smoke testing routes.");
  }

  const port = await findOpenPort();
  const baseUrl = `http://${host}:${port}`;
  const server = spawn(process.execPath, [nextBin, "start", "--hostname", host, "--port", String(port)], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  let stdout = "";

  server.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(baseUrl);
    await smokeRoutes(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\n--- next start stdout ---\n${stdout}\n--- next start stderr ---\n${stderr}`);
  } finally {
    server.kill("SIGTERM");
    await delay(500);
    if (!server.killed) {
      server.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
