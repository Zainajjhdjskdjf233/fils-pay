#!/usr/bin/env python3
"""PreToolUse hook: during the UNDERSTAND phase, block any edit outside docs/.
The phase is stored in .claude/phase ("understand" or "fix"). Missing file = understand."""
import json, os, sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or "."
if data.get("tool_name") not in ("Edit", "Write", "MultiEdit"):
    sys.exit(0)

phase_file = os.path.join(root, ".claude", "phase")
try:
    phase = open(phase_file).read().strip().lower()
except Exception:
    phase = "understand"
if phase == "fix":
    sys.exit(0)

path = (data.get("tool_input") or {}).get("file_path", "")
rel = os.path.relpath(path, root).replace("\\", "/") if path else ""
allowed = rel.startswith("docs/") or rel in (".claude/check.sh",)
if allowed:
    sys.exit(0)

print(f"BLOCKED by phase guard: we are in the UNDERSTAND phase, so only files in docs/ "
      f"can change (you tried {rel}). Finish docs/LOG.md and wait for Zainab to run /fix.",
      file=sys.stderr)
sys.exit(2)
