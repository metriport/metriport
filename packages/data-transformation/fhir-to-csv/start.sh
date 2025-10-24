#!/bin/bash

# FHIR to CSV Transform Startup Script
# Usage: ./start.sh [cli|server]

MODE=${1:-cli}

case $MODE in
  "cli")
    echo "Starting FHIR to CSV in CLI mode..."
    docker-compose up --build
    ;;
  "server")
    echo "Starting FHIR to CSV HTTP server..."
    docker-compose -f docker-compose.server.yml up --build
    ;;
  *)
    echo "Usage: $0 [cli|server]"
    echo "  cli    - Run in CLI mode (default)"
    echo "  server - Run as HTTP server"
    exit 1
    ;;
esac
