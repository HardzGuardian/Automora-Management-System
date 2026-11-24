#!/bin/sh
# Calls one cron endpoint of the app and reports the result.
# 200 = ok, 207 = some parts failed (logged by the app, retried by the next run), anything else = failure.
# Optional: PING_URL gets a GET after an ok run (external "did it run" monitor).
set -u
JOB="${1:?job name: reminders or invoice-due}"
URL="${APP_INTERNAL_URL:?}/api/cron/${JOB}"
CODE="$(curl -sS -o /tmp/job.out -w '%{http_code}' -m 280 -H "Authorization: Bearer ${CRON_SECRET:?}" "$URL" || echo 000)"
echo "$(date -u +%FT%TZ) job=${JOB} status=${CODE} $(head -c 300 /tmp/job.out 2>/dev/null)"
if [ "$CODE" = "200" ]; then
  [ -n "${PING_URL:-}" ] && curl -fsS -m 10 -o /dev/null "$PING_URL" || true
  exit 0
fi
exit 1
