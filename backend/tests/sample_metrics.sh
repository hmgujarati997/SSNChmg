#!/bin/bash
# Sample backend resource usage every 5 seconds while the stress test runs.
# Writes to /tmp/stress_metrics.log
OUT=/tmp/stress_metrics.log
> "$OUT"
echo "ts,backend_cpu_pct,backend_rss_mb,total_mem_used_mb,load_1m,mongo_conn" >> "$OUT"
while true; do
  TS=$(date +%H:%M:%S)
  PID=$(pgrep -f "uvicorn server:app" | head -1)
  if [ -n "$PID" ]; then
    CPU=$(ps -p "$PID" -o %cpu= | tr -d ' ')
    RSS_KB=$(ps -p "$PID" -o rss= | tr -d ' ')
    RSS_MB=$((RSS_KB / 1024))
  else
    CPU="na"; RSS_MB="na"
  fi
  MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
  LOAD=$(cut -d' ' -f1 /proc/loadavg)
  MCONN=$(ss -tn 2>/dev/null | grep -c ":27017")
  echo "$TS,$CPU,$RSS_MB,$MEM_USED,$LOAD,$MCONN" >> "$OUT"
  sleep 5
done
