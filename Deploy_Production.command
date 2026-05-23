#!/bin/bash
echo "========================================="
echo "🌟 DEPLOYING TO PUBLISHED ENVIRONMENT 🌟"
echo "========================================="
cd "/Users/simpsonchan/.gemini/antigravity/scratch/traveltopia-creator" || exit 1

echo "[1/2] Building the latest code..."
npm run build

echo "[2/2] Publishing to Firebase Production..."
npx firebase-tools deploy --only hosting --project full-tt

echo "========================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo "Your live website has been updated."
echo "You can safely close this terminal window."
echo "========================================="
