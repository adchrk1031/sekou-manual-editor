#!/bin/zsh
set -euo pipefail

REPO_OWNER="adchrk1031"
REPO_NAME="sekou-manual-editor"
BRANCH="main"

echo "Checking GitHub authentication..."
gh auth status >/dev/null

echo "Applying branch protection for ${REPO_OWNER}/${REPO_NAME}:${BRANCH}..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
  -f required_status_checks.strict=true \
  -F required_status_checks.contexts[]="build" \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.require_code_owner_reviews=false \
  -f required_pull_request_reviews.required_approving_review_count=0 \
  -f required_pull_request_reviews.require_last_push_approval=false \
  -f restrictions= \
  -f required_linear_history=true \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f block_creations=false \
  -f required_conversation_resolution=true \
  -f lock_branch=false

echo "Enabling delete branch on merge..."
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO_OWNER}/${REPO_NAME}" \
  -f delete_branch_on_merge=true

echo "Done."
