#!/bin/bash
# Kopira sve web fajlove u www/ direktorijum za Capacitor build
#
# Upotreba:
#   ./build-web.sh          → lokalni build (LOCAL_AUTH_MODE = true, bez servera)
#   ./build-web.sh --prod   → produkcijski build za App Store / Play Store

PROD_URL="https://money-track-backend.fly.dev"
IS_PROD=false

if [ "$1" == "--prod" ]; then
  IS_PROD=true
fi

if $IS_PROD; then
  echo "Building PRODUCTION web assets (backend: $PROD_URL)..."
else
  echo "Building LOCAL web assets (local auth mode, no backend)..."
fi

rm -rf www
mkdir -p www

# Kopira sve frontend foldere i fajlove
cp -r public www/
cp -r dashboard www/
cp -r expenses www/
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

# Produkcijski build: upiši pravi backend URL u app-config.js
if $IS_PROD; then
  sed -i '' "s|const BACKEND_PROD_URL = '';|const BACKEND_PROD_URL = '$PROD_URL';|g" www/public/app-config.js
  echo "✓ BACKEND_PROD_URL set to $PROD_URL"
  echo "✓ LOCAL_AUTH_MODE = false (real backend)"
else
  echo "✓ BACKEND_PROD_URL = '' (local mode)"
  echo "✓ LOCAL_AUTH_MODE = true"
fi

echo "Done! Web assets copied to www/"
