#!/usr/bin/env python3
"""R76 — disciplined mini-service restart for the fleet console.

The guardian (.zscripts/guardian.py) built the estate's bounce discipline:
kill tree -> REQUIRE the port free -> daemonize a fresh instance -> wait
for the healthy answer. This helper applies the EXACT same machinery to a
mini-service, by IMPORTING guardian.py's functions (no copied logic — one
implementation of the discipline):

  1. identify the service's pid by EXACT cwd match (every mini-service
     runs as plain "bun" — the working directory is the honest identifier;
     a cwd mismatch means the process is not who the registry says it is)
  2. kill_tree() — SIGTERM the whole tree, wait, SIGKILL survivors
  3. REQUIRE the port free (10s budget) — the R56 duplicate-instance class
     dies here, same as on :3000
  4. daemonize a fresh instance with the registry's exact command + log
  5. wait until the root answers the REGISTRY's expected status (200 or
     404 per service — a pure-API 404 is health, not failure), retrying
     the pidfile read to dodge the R66 grandchild-write race
  6. print one JSON result line: {ok, oldPid, newPid, downtimeMs,
     httpStatus, error} — the caller (TS route) journals it verbatim

Scratch-testable: --expect / --port / --cwd are parameters; a --dry-run
resolves the pid and reports, touching nothing.

Usage:
  python3 .zscripts/mini_service_restart.py \
    --port 3007 --expect 200 --cwd /home/z/my-project/mini-services/mesh-demo \
    --cmd bun --args "--hot,index.ts" --log /home/z/my-project/.zscripts/mini-service-mesh-demo.log
"""
import argparse
import importlib.util
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

GUARDIAN_PATH = "/home/z/my-project/.zscripts/guardian.py"
DAEMONIZE = "/home/z/my-project/.zscripts/daemonize.py"

spec = importlib.util.spec_from_file_location("guardian_r76", GUARDIAN_PATH)
g = importlib.util.module_from_spec(spec)
sys.modules["guardian_r76"] = g
spec.loader.exec_module(g)


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def find_pid_by_cwd(cwd: str):
    """The ONE live process whose cwd == cwd (None if absent, -1 if
    ambiguous — ambiguity is reported, never guessed at)."""
    matches = []
    for entry in g.os.listdir("/proc"):
        if not entry.isdigit():
            continue
        pid = int(entry)
        if g.proc_cwd(pid) == cwd:
            matches.append(pid)
    if len(matches) == 1:
        return matches[0]
    if len(matches) == 0:
        return None
    return -1


def root_status(port: int, timeout: float = 2.0):
    """HTTP status of the root answer, or None when unreachable. Unlike
    guardian's http_ok this returns the STATUS — a 404 can be the
    healthy answer for a pure-API service."""
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError:
        return None


def main():
    p = argparse.ArgumentParser(description="R76 fleet restart (guardian discipline)")
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--expect", type=int, required=True, help="healthy root HTTP status (200, or 404 for pure-API)")
    p.add_argument("--cwd", required=True, help="the service's exact working directory = its identity")
    p.add_argument("--cmd", required=True)
    p.add_argument("--args", default="", help="comma-separated argv tail for --cmd")
    p.add_argument("--log", required=True)
    p.add_argument("--boot-timeout", type=int, default=30)
    p.add_argument("--dry-run", action="store_true", help="resolve + report, touch nothing")
    args = p.parse_args()

    result = {
        "ok": False,
        "oldPid": None,
        "newPid": None,
        "downtimeMs": None,
        "httpStatus": None,
        "error": None,
    }
    t0 = time.time()

    # 1) identify — the cwd is the identifier.
    pid = find_pid_by_cwd(args.cwd)
    if pid == -1:
        result["error"] = f"ambiguous: multiple live processes share cwd {args.cwd} — refusing to guess"
        print(json.dumps(result))
        return 1
    result["oldPid"] = pid

    if args.dry_run:
        result["ok"] = True
        result["httpStatus"] = root_status(args.port) if pid else None
        print(json.dumps(result))
        return 0

    # 2) kill the tree (guardian's kill_tree: TERM -> wait -> KILL).
    if pid is not None:
        if not g.kill_tree(pid, wait_seconds=8.0):
            result["error"] = "old tree survived SIGKILL"
            result["downtimeMs"] = int((time.time() - t0) * 1000)
            print(json.dumps(result))
            return 1

    # 3) REQUIRE the port free before spawning (R56 class).
    deadline = time.time() + 10.0
    while time.time() < deadline:
        if not g.port_ok(args.port, timeout=1.0):
            break
        time.sleep(0.5)
    if g.port_ok(args.port, timeout=1.0):
        result["error"] = f"port {args.port} still listening before spawn — refusing to create a duplicate"
        result["downtimeMs"] = int((time.time() - t0) * 1000)
        print(json.dumps(result))
        return 1

    # 4) daemonize the registry's exact command.
    cmd_args = [a for a in args.args.split(",") if a] if args.args else []
    try:
        subprocess.run(
            [sys.executable, DAEMONIZE,
             "--cwd", args.cwd,
             "--pidfile", f"/home/z/my-project/.zscripts/fleet-{args.port}.pid",
             "--log", args.log,
             "--", args.cmd, *cmd_args],
            check=True, timeout=30, cwd="/home/z/my-project",
        )
    except (OSError, subprocess.SubprocessError) as e:
        result["error"] = f"daemonize spawn failed: {e}"
        result["downtimeMs"] = int((time.time() - t0) * 1000)
        print(json.dumps(result))
        return 1

    # 5) wait for the REGISTRY's healthy answer; retry the pidfile read
    # (daemonize's grandchild writes it a few ms after the parent returns —
    # the R66 race, dodged the same way the guardian dodges it).
    new_pid = None
    deadline = time.time() + 10.0
    while time.time() < deadline:
        try:
            with open(f"/home/z/my-project/.zscripts/fleet-{args.port}.pid") as f:
                candidate = int(f.read().strip())
            if candidate and g.pid_alive(candidate):
                new_pid = candidate
                break
        except (OSError, ValueError):
            pass
        time.sleep(0.25)
    result["newPid"] = new_pid

    deadline = time.time() + args.boot_timeout
    while time.time() < deadline:
        status = root_status(args.port)
        result["httpStatus"] = status
        if status == args.expect:
            result["ok"] = True
            result["downtimeMs"] = int((time.time() - t0) * 1000)
            print(json.dumps(result))
            return 0
        time.sleep(1.0)

    result["error"] = f"root did not answer HTTP {args.expect} within {args.boot_timeout}s (last: {result['httpStatus']})"
    result["downtimeMs"] = int((time.time() - t0) * 1000)
    print(json.dumps(result))
    return 1


if __name__ == "__main__":
    sys.exit(main())
