#!/bin/bash
cd "$(dirname "$0")"
deno run --allow-read --allow-ffi --allow-env=DENO_PYTHON_PATH --allow-net --allow-run --unstable-ffi src/main.ts "$@"
