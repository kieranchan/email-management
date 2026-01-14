#!/bin/bash
# Server-side update script for Nexus Mail
# Run this on your production server to update to the latest version

set -e

echo "🔄 Pulling latest image from Docker Hub..."
docker-compose -f docker-compose.prod.yml pull

echo "🔄 Restarting containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Update complete!"
echo ""
echo "📊 Current status:"
docker-compose -f docker-compose.prod.yml ps
