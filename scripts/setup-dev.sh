#!/usr/bin/env bash
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/setup-dev.sh                                                    ║
# ║  LAYER: automation                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

set -e

echo "  ∞ Welcome to Heady Systems Development Setup ∞ "

# 1. Validate Node.js 20+
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "  ⚠ Node.js 20+ is required. Found $NODE_VERSION"
  exit 1
fi
echo "  ∞ Node.js 20+ detected."

# 2. Check Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "  ⚠ Docker is required."
  exit 1
fi
echo "  ∞ Docker detected."

# 3. Check .env
if [ ! -f .env ]; then
  echo "  ∞ Copying .env.example to .env..."
  cp .env.example .env
fi
echo "  ∞ .env file ready."

# 4. Install dependencies
echo "  ∞ Installing dependencies..."
npm install

# 5. Pull Docker images
echo "  ∞ Pulling required Docker images..."
docker-compose pull

# 6. Boot in development mode
echo "  ∞ Booting docker-compose in development mode..."
docker-compose up -d

echo "  ∞ Development environment is ready!"
echo "  ∞ Visit http://localhost:3300 for the Sacred Geometry UI."
