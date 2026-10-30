#!/usr/bin/env python3
"""PostToolUse hook: append every Edit / Write / Bash action to docs/ACTIONS.md.
Runs automatically; Claude cannot skip it."""
import json, os, sys, datetime

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or "."
tool = data.get("tool_name", "")
inp = data.get("tool_input", {}) or {}

if tool in ("Edit", "Write", "MultiEdit"):
    path = inp.get("file_path", "")
    rel = os.path.relpath(path, root) if path else "?"
    if rel.replace("\\", "/") == "docs/ACTIONS.md":
        sys.exit(0)
    kind, what = ("WRITE" if tool == "Write" else "EDIT"), rel
elif tool == "Bash":
    cmd = " ".join(str(inp.get("command", "")).split())
    kind, what = "RUN", (cmd[:140] + "...") if len(cmd) > 140 else cmd
else:
    sys.exit(0)

docs = os.path.join(root, "docs")
os.makedirs(docs, exist_ok=True)
log = os.path.join(docs, "ACTIONS.md")
new = not os.path.exists(log)
t = datetime.datetime.now().strftime("%I:%M %p").lstrip("0")
with open(log, "a", encoding="utf-8") as f:
    if new:
        f.write("# ACTIONS (written automatically by a hook)\n\n")
    f.write(f"- {t} | {kind:<5} | {what}\n")
sys.exit(0)
