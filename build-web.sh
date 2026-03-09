#!/bin/bash
# Kopira sve web fajlove u www/ direktorijum za Capacitor build

echo "Building web assets for Capacitor..."

rm -rf www
mkdir -p www

# Kopira sve frontend foldere i fajlove
cp -r public www/
cp -r dashboard www/
cp -r expenses www/
cp -r shared www/
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

echo "Done! Web assets copied to www/"
