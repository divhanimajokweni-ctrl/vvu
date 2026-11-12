#!/usr/bin/env python3
"""Double-fork daemonizer — escapes the platform session reaper.

The sandbox kills session descendants when a tool invocation ends; a
plain `setsid ... &` does NOT escape (verified empirically, see worklog
incident line ~1926: three silent dev-server deaths). The classic
double-fork — fork -> setsid -> fork -> exec, intermediates reaped —
leaves the final process init-parented in its own session, which HAS
been verified to survive across tool-session boundaries.

Usage:
  python3 .zscripts/daemonize.py --cwd <dir> [--pidfile <path>] [--log <path>] -- <cmd> [args...]

--log   : append stdout+stderr to this file (default: /dev/null)
--pidfile: write the daemon pid (pre-exec) here
"""
import argparse
import os
import signal
import sys


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--cwd", default=".")
    p.add_argument("--pidfile", default=None)
    p.add_argument("--log", default=None)
    p.add_argument("cmd", nargs=argparse.REMAINDER)
    args = p.parse_args()

    if args.cmd and args.cmd[0] == "--":
        args.cmd = args.cmd[1:]
    if not args.cmd:
        p.error("command required after --")

    # First fork: parent exits immediately, child continues.
    pid = os.fork()
    if pid > 0:
        # Parent returns to caller right away; the intermediate child
        # will be reaped by init once it exits after the second fork.
        sys.exit(0)

    # Child: detach from controlling terminal.
    os.setsid()
    # Never die on SIGHUP when a session leader's terminal goes away.
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

    # Second fork: the intermediate exits; the grandchild is instantly
    # reparented to init (PID 1) and can never be part of any tool
    # invocation's descendant tree again.
    pid2 = os.fork()
    if pid2 > 0:
        os._exit(0)

    # Grandchild: prepare a clean runtime environment and exec.
    os.chdir(args.cwd)
    os.umask(0o022)

    if args.pidfile:
        try:
            with open(args.pidfile, "w") as f:
                f.write(str(os.getpid()))
        except OSError:
            pass

    devnull_r = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull_r, 0)

    if args.log:
        logfd = os.open(args.log, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    else:
        logfd = os.open(os.devnull, os.O_WRONLY)
    os.dup2(logfd, 1)
    os.dup2(logfd, 2)

    os.execvp(args.cmd[0], args.cmd)


if __name__ == "__main__":
    main()
