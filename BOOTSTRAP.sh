#!/usr/bin/env bash
# BOOTSTRAP.sh — fresh-clone setup for tokengratis.id
# Usage:
#   bash BOOTSTRAP.sh
#
# Reference: ~/.claude/playbook/PLAYBOOK.md §5 (bootstrap levels)

set -euo pipefail

REPO_SLUG="tokengratis-id"   # CHANGE THIS to GitHub repo slug

# 1. Load credentials (shared + per-project + env.local)
echo "Loading credentials..."
set -a
[ -f ~/.claude/.credentials.shared ] && source ~/.claude/.credentials.shared
[ -f .credentials ] && source .credentials
[ -f .env.local ] && source .env.local
set +a
[ -n "${GITHUB_PAT:-}" ] && export GH_TOKEN="$GITHUB_PAT"

# 2. Verify in correct repo
if [ ! -d ".git" ]; then
  echo "ERROR: not in a git repo. cd to tokengratis.id first." >&2
  exit 1
fi
echo "Repo: $(git remote get-url origin 2>/dev/null || echo 'no remote')"
echo "Branch: $(git branch --show-current)"

# 3. Install deps (auto-detect package manager)
if [ -f "package-lock.json" ]; then
  echo "npm install..."
  npm install --no-audit --no-fund
elif [ -f "pnpm-lock.yaml" ]; then
  echo "pnpm install..."
  pnpm install --frozen-lockfile
elif [ -f "yarn.lock" ]; then
  echo "yarn install..."
  yarn install --frozen-lockfile
elif [ -f "requirements.txt" ]; then
  echo "pip install..."
  pip install -r requirements.txt
else
  echo "No known dependency manifest found. Skip install."
fi

# 4. Typecheck baseline (TypeScript only)
if [ -f "tsconfig.json" ] && [ -x "node_modules/.bin/tsc" ]; then
  echo "Typecheck baseline..."
  ERR_COUNT=$(./node_modules/.bin/tsc --noEmit 2>&1 | wc -l)
  echo "  Typecheck output lines: $ERR_COUNT (expected baseline: 0)"
fi

# 5. Wire git post-commit hook → .claude/hooks/post-commit.sh
if [ -f ".claude/hooks/post-commit.sh" ] && [ ! -e ".git/hooks/post-commit" ]; then
  echo "Wiring git post-commit hook..."
  ln -sf "../../.claude/hooks/post-commit.sh" ".git/hooks/post-commit" 2>/dev/null \
    || cp ".claude/hooks/post-commit.sh" ".git/hooks/post-commit"
  chmod +x ".git/hooks/post-commit"
fi

echo ""
echo "Bootstrap complete."
echo "  Stack: see CLAUDE.md"
echo "  Current state: docs/STATE.md"
echo "  Numbered learnings: docs/log.md"
echo "  Changelog: docs/CHANGELOG.md"
echo ""
echo "Push pattern (feature branch + PR + Vercel preview):"
echo "  git checkout -b feat/<scope>"
echo "  git add -A && git -c user.email='raymondchin.s@gmail.com' -c user.name='raymondchins' commit -m 'feat(scope): msg'"
echo "  git push -u origin feat/<scope>"
echo "  gh pr create --fill"
