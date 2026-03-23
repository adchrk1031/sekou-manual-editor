import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "..", "..");

const requiredFiles = [
  "AGENTS.md",
  "README.md",
  ".github/pull_request_template.md",
  ".github/workflows/pr-build.yml",
  ".github/workflows/vercel-production.yml",
  "docs/restart/DEPLOY_GITHUB_SAFETY_GUIDE.md",
  "docs/restart/PROJECT_RESTART_GUIDE.md",
  "docs/restart/PLANNER_SPLIT_MAP.md",
  "docs/templates/SKILL_TEMPLATE/SKILL.md",
];

const errors = [];

for (const relativePath of requiredFiles) {
  if (!existsSync(path.join(repoRoot, relativePath))) {
    errors.push(`Missing required file: ${relativePath}`);
  }
}

const packageJsonPath = path.join(repoRoot, "package.json");
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (packageJson.name !== "sekou-manual-editor") {
    errors.push(`package.json name must be "sekou-manual-editor" but was "${packageJson.name}"`);
  }
  if (!packageJson.scripts || packageJson.scripts.build !== "next build") {
    errors.push('package.json must define "build": "next build"');
  }
  if (!packageJson.scripts || packageJson.scripts["safety:check"] !== "node scripts/safety/verify-repo-safety.mjs") {
    errors.push('package.json must define "safety:check": "node scripts/safety/verify-repo-safety.mjs"');
  }
}

const readmePath = path.join(repoRoot, "README.md");
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8");
  const requiredReadmeSnippets = [
    "GitHub / デプロイ安全運用",
    "PR build workflow",
    "現在の安全対策ステータス",
  ];
  for (const snippet of requiredReadmeSnippets) {
    if (!readme.includes(snippet)) {
      errors.push(`README.md is missing required safety section text: ${snippet}`);
    }
  }
}

const prWorkflowPath = path.join(repoRoot, ".github/workflows/pr-build.yml");
if (existsSync(prWorkflowPath)) {
  const prWorkflow = readFileSync(prWorkflowPath, "utf8");
  const requiredWorkflowSnippets = [
    "pull_request:",
    "npm ci",
    "npm run safety:check",
    "npm run build",
  ];
  for (const snippet of requiredWorkflowSnippets) {
    if (!prWorkflow.includes(snippet)) {
      errors.push(`.github/workflows/pr-build.yml is missing: ${snippet}`);
    }
  }
}

const deployWorkflowPath = path.join(repoRoot, ".github/workflows/vercel-production.yml");
if (existsSync(deployWorkflowPath)) {
  const deployWorkflow = readFileSync(deployWorkflowPath, "utf8");
  const requiredDeploySnippets = [
    "push:",
    "branches:",
    "- main",
    "vercel deploy --prebuilt --prod",
  ];
  for (const snippet of requiredDeploySnippets) {
    if (!deployWorkflow.includes(snippet)) {
      errors.push(`.github/workflows/vercel-production.yml is missing: ${snippet}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Repository safety check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Repository safety check passed.");
