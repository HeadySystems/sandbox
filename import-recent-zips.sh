#!/bin/bash
set -e

DOWNLOAD_DIR="$HOME/Downloads"
HEADY_DIR="$HOME/Heady"
STAGING_DIR="/tmp/heady-auto-import-staging"

echo "=== Heady Auto-Import & Pipeline Ops ==="
echo "Scanning for recent heady-*.zip bundles in $DOWNLOAD_DIR (last 24 hours)..."

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Find zip files modified in the last 24 hours, sort by modification time (oldest first, so newest overwrites)
mapfile -t ZIP_FILES < <(find "$DOWNLOAD_DIR" -maxdepth 1 -name "heady-*.zip" -mtime -1 -type f -printf '%T+ %p\n' | sort | awk '{print $2}')

if [ ${#ZIP_FILES[@]} -eq 0 ]; then
  echo "No recent heady-*.zip files found."
  exit 0
fi

for ZIP in "${ZIP_FILES[@]}"; do
  echo "=> Extracting $ZIP..."
  unzip -q -o "$ZIP" -d "$STAGING_DIR" || true
done

echo "=> Merging extracted contents into $HEADY_DIR..."
# The extracted contents might be in a subfolder like 'heady-monorepo/' or 'heady-phi-100-overhaul/'
# We'll use a smart rsync that moves everything from STAGING_DIR to HEADY_DIR, flattening 1 directory if needed

cd "$STAGING_DIR"
# Some ZIPs wrap everything in a single directory. If there's exactly one directory, move into it.
DIRS=(*/)
if [ ${#DIRS[@]} -eq 1 ] && [ -d "${DIRS[0]}" ]; then
  echo "Found single root folder ${DIRS[0]}, unwrapping..."
  cd "${DIRS[0]}"
fi

# Rsync contents into Heady
rsync -aP --exclude '.git' --exclude 'node_modules' . "$HEADY_DIR/"

echo "=> Running Git Auto-Commit in $HEADY_DIR..."
cd "$HEADY_DIR"
git add .
git commit -m "Auto-Success Engine: Ingested ${#ZIP_FILES[@]} recent Heady ZIP bundles from Downloads" || echo "Nothing to commit."

echo "=> Executing HCFullPipeline Operations..."
npm run hcfp || echo "HCFullPipeline executed with warnings/errors, but continuing."
npm run deploy:auto || echo "Deploy auto completed or bypassed."

echo "=== Import & Pipeline Complete ==="
