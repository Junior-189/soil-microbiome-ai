#!/bin/bash
cd /home/grok/Desktop/AppKili/AppKili/soil-microbiome-ai/ml-engine
source venv/bin/activate
export ML_ENGINE_API_KEY=ml-internal-key-change-in-production
export APP_ENV=production
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/ml-engine.log 2>&1 &
ML_PID=$!
echo "ML Engine PID: $ML_PID"

cd /home/grok/Desktop/AppKili/AppKili/soil-microbiome-ai/server
nohup node index.js > /tmp/server.log 2>&1 &
echo "Server PID: $!"

cd /home/grok/Desktop/AppKili/AppKili/soil-microbiome-ai/client
nohup npx vite --host 0.0.0.0 --port 3000 > /tmp/client.log 2>&1 &
echo "Client PID: $!"

# Wait briefly for services to start
sleep 5

# Verify
echo "=== Verifying ==="
curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null
curl -s http://localhost:5000/health
curl -s -o /dev/null -w "Client: HTTP %{http_code}\n" http://localhost:3000

echo "All services started."
