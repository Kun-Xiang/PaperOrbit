#!/usr/bin/env bash
# PaperOrbit local development server (loopback identity + local providers).
# Wraps the project's own launcher unchanged; see README.md "本地完整使用".
set -euo pipefail
cd "${ROOT_DIR:?Run via: bash execs/run.sh dev_local}"
exec npm run dev:local "$@"
