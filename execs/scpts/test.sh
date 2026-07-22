#!/usr/bin/env bash
# PaperOrbit test suite: builds the worker, then runs node --test tests/.
set -euo pipefail
cd "${ROOT_DIR:?Run via: bash execs/run.sh test}"
exec npm test "$@"
