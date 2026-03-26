import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..");
const errors = [];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assertFileIncludes(relativePath, snippets) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    errors.push(`Missing file for deep safety check: ${relativePath}`);
    return;
  }
  const content = read(relativePath);
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${relativePath} is missing required snippet: ${snippet}`);
    }
  }
}

assertFileIncludes(".gitignore", [
  "artifacts/",
  "__pycache__/",
  "*.pyc",
  "scripts/safety/ev_extract_candidates.py",
]);

assertFileIncludes("AGENTS.md", [
  "main",
  "1 PR = 1責務",
  "branch protection",
]);

assertFileIncludes("README.md", [
  "npm run safety:full",
  "smoke test",
  "pre-push hook",
]);

assertFileIncludes("docs/restart/DEPLOY_GITHUB_SAFETY_GUIDE.md", [
  "branch protection",
  "required check",
  "safety:full",
  "smoke test",
]);

assertFileIncludes("app/(workspace)/editor-next/page.tsx", [
  "ProtectedWorkspace",
  "PlannerWorkspace",
]);

assertFileIncludes(".github/workflows/pr-build.yml", [
  "branches-ignore:",
  "npm run safety:full",
  "timeout-minutes:",
]);

assertFileIncludes(".github/workflows/vercel-production.yml", [
  "npm run safety:check",
  "npm run safety:check:deep",
  "npm run build",
  "npm run smoke:routes",
]);

assertFileIncludes(".githooks/pre-push", [
  "npm run safety:full",
]);

assertFileIncludes("scripts/github/apply-repo-safety.sh", [
  "required_status_checks.contexts[]=\"safety-full\"",
  "required_conversation_resolution=true",
]);

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const forbiddenTrackedPatterns = [
  /(^|\/)__pycache__(\/|$)/,
  /\.pyc$/,
  /^artifacts\//,
  /^scripts\/safety\/ev_extract_candidates\.py$/,
];

for (const trackedFile of trackedFiles) {
  if (forbiddenTrackedPatterns.some((pattern) => pattern.test(trackedFile))) {
    errors.push(`Repository contains accidental local artifact path: ${trackedFile}`);
  }
}

if (errors.length > 0) {
  console.error("Deep safety check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Deep safety check passed.");
