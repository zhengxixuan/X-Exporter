#!/bin/bash

# Script to download open source fonts for the extension
# Run this script from the project root: bash src/assets/fonts/download-fonts.sh

FONTS_DIR="src/assets/fonts"

echo "Downloading fonts to $FONTS_DIR..."

# Download Inter font (Latin)
# Using Google Fonts API to get woff2 format
echo "Downloading Inter font..."
curl -o "$FONTS_DIR/Inter-Regular.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2"

curl -o "$FONTS_DIR/Inter-SemiBold.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2"

curl -o "$FONTS_DIR/Inter-Bold.woff2" \
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiA.woff2"

# Download Noto Sans SC font (Simplified Chinese)
echo "Downloading Noto Sans SC font..."
curl -o "$FONTS_DIR/NotoSansSC-Regular.woff2" \
  "https://fonts.gstatic.com/s/notosanssc/v36/k3kXo84MPvpLmixcA63oeALhL4iJ-Q7m8g.woff2"

curl -o "$FONTS_DIR/NotoSansSC-Bold.woff2" \
  "https://fonts.gstatic.com/s/notosanssc/v36/k3kQo84MPvpLmixcA63oeALZTYKL2wv6F6Ds.woff2"

echo "Fonts downloaded successfully!"
echo ""
echo "Next steps:"
echo "1. Update src/content/style.css to include @font-face declarations"
echo "2. Ensure manifest.config.ts includes these font files in web_accessible_resources"
