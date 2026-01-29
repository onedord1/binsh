#!/bin/bash
# binsh launcher script - starts server and opens browser

# Start binsh server in background
$SNAP/bin/binsh &
SERVER_PID=$!

# Wait for server to be ready (max 10 seconds)
for i in {1..20}; do
    if curl -s http://localhost:9876/api/health > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open browser
if command -v xdg-open > /dev/null 2>&1; then
    xdg-open http://localhost:9876
elif command -v gnome-open > /dev/null 2>&1; then
    gnome-open http://localhost:9876
elif command -v firefox > /dev/null 2>&1; then
    firefox http://localhost:9876
elif command -v chromium > /dev/null 2>&1; then
    chromium http://localhost:9876
fi

# Keep script running to maintain the server
wait $SERVER_PID
