#!/bin/sh
set -eu

echo "[entry] PATH=$PATH"
echo "[entry] which python3: $(command -v python3 || true)"
python3 - <<'PY'
import ssl, sys, transformers, numpy
print(f"[entry] py ok: {sys.version.split()[0]} | {ssl.OPENSSL_VERSION}")
print(f"[entry] transformers {transformers.__version__}")
print(f"[entry] numpy {numpy.__version__}")
PY

export HOST="${COG_HOST:-127.0.0.1}"
export PORT="${COG_PORT:-5000}"
echo "[entry] starting shim on ${HOST}:${PORT}"

# Start our in-proc HTTP shim (no multiprocessing)
python3 /opt/model/serve.py &

# Wait up to 60s for /healthz so the first invoke won't race
i=0
while [ $i -lt 60 ]; do
  if python3 - "$HOST" "$PORT" <<'PY'
import sys, urllib.request
h, p = sys.argv[1], int(sys.argv[2])
try:
    urllib.request.urlopen(f"http://{h}:{p}/healthz", timeout=0.5)
    raise SystemExit(0)
except Exception:
    raise SystemExit(1)
PY
  then
    echo "[entry] shim ready"
    break
  fi
  i=$((i+1))
  sleep 1
done
[ $i -ge 60 ] && echo "[entry] WARNING: shim not ready yet; continuing"

# Hand off to Node's Lambda runtime
exec /lambda-entrypoint.sh "$@"
