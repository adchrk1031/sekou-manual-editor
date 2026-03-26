import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..");

// Keep removed sibling projects blocked so they cannot be reintroduced into this repo.
const BLOCKED_PREFIXES = [
  "meter-ocr-ledger-tool/",
  "slack-mention-todo-tool/",
  "rezil-ai-unified-demo/",
  "rezil-ai-division-brief/",
];

function runGit(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function canResolve(ref) {
  try {
    runGit(["rev-parse", "--verify", ref]);
    return true;
  } catch {
    return false;
  }
}

function resolveDiffBase() {
  const explicitBase = process.env.SAFETY_SCOPE_BASE?.trim();
  if (explicitBase && explicitBase !== "0000000000000000000000000000000000000000" && canResolve(explicitBase)) {
    return explicitBase;
  }

  try {
    const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
    if (upstream && canResolve(upstream)) {
      return runGit(["merge-base", "HEAD", upstream]);
    }
  } catch {
    // No upstream configured.
  }

  if (canResolve("origin/main")) {
    return runGit(["merge-base", "HEAD", "origin/main"]);
  }

  if (canResolve("HEAD^")) {
    return runGit(["rev-parse", "HEAD^"]);
  }

  return "";
}

function listChangedEntries(baseRef) {
  const args = ["diff", "--name-status", "--find-renames"];
  if (baseRef) {
    args.push(`${baseRef}..HEAD`);
  }

  return runGit(args)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...pathParts] = line.split("\t");
      const file = pathParts[pathParts.length - 1]?.trim() ?? "";
      return { status, file };
    })
    .filter((entry) => entry.file);
}

const baseRef = resolveDiffBase();
const changedEntries = listChangedEntries(baseRef);
const blockedEntries = changedEntries.filter(({ file }) =>
  BLOCKED_PREFIXES.some((prefix) => file.startsWith(prefix)),
);
const blockedNonDeletionEntries = blockedEntries.filter(({ status }) => !status.startsWith("D"));

if (blockedNonDeletionEntries.length > 0 && process.env.ALLOW_CROSS_PROJECT_CHANGES !== "1") {
  console.error("Repository boundary check failed.");
  console.error("This branch includes changes from a sibling project that must not be deployed with sekou-manual-editor.");
  console.error("Deleting a blocked sibling directory is allowed, but adding or editing files there is not.");
  console.error("Blocked files:");
  for (const { status, file } of blockedNonDeletionEntries) {
    console.error(`- [${status}] ${file}`);
  }
  console.error("If this cross-project change is truly intentional, rerun with ALLOW_CROSS_PROJECT_CHANGES=1.");
  process.exit(1);
}

if (blockedNonDeletionEntries.length > 0) {
  console.log("Repository boundary check bypassed via ALLOW_CROSS_PROJECT_CHANGES=1.");
} else if (blockedEntries.length > 0) {
  console.log(
    `Repository boundary check passed.${baseRef ? ` Diff base: ${baseRef}` : ""} Allowed deletions: ${blockedEntries.length}`,
  );
} else {
  console.log(`Repository boundary check passed.${baseRef ? ` Diff base: ${baseRef}` : ""}`);
}
