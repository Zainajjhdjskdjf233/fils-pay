#!/bin/bash
# PostToolUse hook: after an edit in the FIX phase, run .claude/check.sh.
# On failure, show the output to Claude (exit 2) so it stops and explains.
cat > /dev/null
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ "$(cat .claude/phase 2>/dev/null)" = "fix" ] || exit 0
[ -x .claude/check.sh ] || exit 0
OUT=$(.claude/check.sh 2>&1); STATUS=$?
if [ $STATUS -ne 0 ]; then
  echo "check.sh FAILED after this edit (exit $STATUS). Last lines:" >&2
  echo "$OUT" | tail -n 25 >&2
  echo "Stop. Explain to Zainab in simple English what broke, then fix it." >&2
  exit 2
fi
exit 0
