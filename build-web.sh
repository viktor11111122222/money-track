#!/bin/bash
# Kopira sve web fajlove u www/ direktorijum za Capacitor build
#
# Upotreba:
#   ./build-web.sh          → lokalni build (LOCAL_AUTH_MODE = true, bez servera)
#   ./build-web.sh --local  → WiFi build (LOCAL_AUTH_MODE = false, lokalni server na istoj mreži)
#   ./build-web.sh --prod   → produkcijski build za App Store / Play Store

PROD_URL="https://money-track-backend.fly.dev"
IS_PROD=false
IS_LOCAL_SERVER=false

if [ "$1" == "--prod" ]; then
  IS_PROD=true
elif [ "$1" == "--local" ]; then
  IS_LOCAL_SERVER=true
fi

if $IS_PROD; then
  echo "Building PRODUCTION web assets (backend: $PROD_URL)..."
elif $IS_LOCAL_SERVER; then
  echo "Building LOCAL SERVER web assets (LOCAL_AUTH_MODE = false, WiFi backend)..."
else
  echo "Building LOCAL web assets (LOCAL_AUTH_MODE = true, no backend)..."
fi

rm -rf www
mkdir -p www

# Kopira sve frontend foldere i fajlove
cp -r public www/
cp -r dashboard www/
cp -r expenses www/
cp -r spendings www/
cp -r shared www/
cp -r onboarding www/
cp manifest.json www/
cp sw.js www/

# Napravi root index.html koji odmah učitava dashboard
cat > www/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script>window.location.href = '/dashboard/index.html';</script>
</head>
<body></body>
</html>
EOF

# Postavi backend URL i auth mode u app-config.js
if $IS_PROD; then
  sed -i '' "s|const BACKEND_PROD_URL = '';|const BACKEND_PROD_URL = '$PROD_URL';|g" www/public/app-config.js
  sed -i '' "s|const LOCAL_AUTH_MODE = true;|const LOCAL_AUTH_MODE = false;|g" www/public/app-config.js
  echo "✓ BACKEND_PROD_URL set to $PROD_URL"
  echo "✓ LOCAL_AUTH_MODE = false (real backend)"
elif $IS_LOCAL_SERVER; then
  sed -i '' "s|const LOCAL_AUTH_MODE = true;|const LOCAL_AUTH_MODE = false;|g" www/public/app-config.js
  echo "✓ BACKEND_PROD_URL = '' (uses BACKEND_LOCAL_IP from app-config.js)"
  echo "✓ LOCAL_AUTH_MODE = false (real backend on local WiFi)"
else
  sed -i '' "s|const LOCAL_AUTH_MODE = false;|const LOCAL_AUTH_MODE = true;|g" www/public/app-config.js
  echo "✓ BACKEND_PROD_URL = '' (offline mode)"
  echo "✓ LOCAL_AUTH_MODE = true (no backend needed)"
fi

echo "Done! Web assets copied to www/"
