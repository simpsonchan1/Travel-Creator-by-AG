#!/bin/bash
echo "======================================"
echo "🚀 DEPLOYING TO TESTING ENVIRONMENT 🚀"
echo "======================================"
cd "/Users/simpsonchan/.gemini/antigravity/scratch/traveltopia-creator" || exit 1

echo "[1/2] Building the latest code..."
npm run build

echo "[2/2] Publishing to Firebase Preview Channel..."
npx firebase-tools hosting:channel:deploy staging --project full-tt

echo "======================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "You can safely close this terminal window."
echo "======================================"
