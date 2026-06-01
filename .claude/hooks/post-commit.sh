#!/bin/bash
# post-commit hook — reminder to invoke /agent log-updater
#
# Wires to git's .git/hooks/post-commit (via BOOTSTRAP.sh ln -sf).
# This script does NOT auto-invoke the agent (the harness doesn't watch git);
# it just prints a reminder so Claude sees it in the bash output and can act.

# Skip during merge/rebase to avoid noise
if [ -f "$(git rev-parse --git-dir)/MERGE_MSG" ] || [ -d "$(git rev-parse --git-dir)/rebase-merge" ]; then
  exit 0
fi

LAST_COMMIT=$(git log -1 --oneline)
echo "[hook] post-commit: $LAST_COMMIT" >&2
echo "[hook] reminder: invoke '/agent log-updater' to sync docs/{STATE,log,CHANGELOG}.md" >&2
