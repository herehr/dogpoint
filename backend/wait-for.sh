#!/bin/sh

# wait-for.sh
# Wait for a host:port to be ready before continuing
# Usage: ./wait-for.sh host:port -- command_to_run

HOST_PORT="$1"
shift

HOST=$(echo "$HOST_PORT" | cut -d: -f1)
PORT=$(echo "$HOST_PORT" | cut -d: -f2)

echo "⏳ Waiting for $HOST:$PORT..."

while ! nc -z "$HOST" "$PORT"; do
  sleep 1
done

echo "✅ $HOST:$PORT is available. Starting application..."

exec "$@"
