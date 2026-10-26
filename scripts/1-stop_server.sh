#!/bin/bash
echo "==> [ApplicationStop] Stopping Old Application Server..."
if pgrep -f "node index.js" > /dev/null; then
  pkill -f "node index.js"
  sleep 2
fi
echo "Old Server Stopped successfully."
exit 0