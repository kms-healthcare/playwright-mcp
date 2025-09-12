#!/bin/bash

# Playwright MCP Docker Compose Runner
# This script helps you manage the Playwright MCP server with Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are available
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Playwright MCP Docker Compose Runner"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start, up      Start the Playwright MCP server"
    echo "  stop, down     Stop the Playwright MCP server"
    echo "  restart        Restart the Playwright MCP server"
    echo "  logs           Show logs from the server"
    echo "  status         Show status of the server"
    echo "  build          Build the Docker image"
    echo "  health         Run health check"
    echo "  clean          Stop and remove containers, networks, and volumes"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start       # Start the server in background"
    echo "  $0 logs        # View server logs"
    echo "  $0 health      # Check if server is healthy"
}

# Function to start the service
start_service() {
    print_status "Starting Playwright MCP server..."
    
    # Create output directory if it doesn't exist
    mkdir -p output
    
    # Check if we should use 'docker compose' or 'docker-compose'
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    $COMPOSE_CMD up -d
    
    if [ $? -eq 0 ]; then
        print_success "Playwright MCP server started successfully!"
        print_status "Server is available at: http://localhost:8931/mcp"
        print_status "Use '$0 logs' to view logs"
        print_status "Use '$0 status' to check status"
    else
        print_error "Failed to start Playwright MCP server"
        exit 1
    fi
}

# Function to stop the service
stop_service() {
    print_status "Stopping Playwright MCP server..."
    
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    $COMPOSE_CMD down
    
    if [ $? -eq 0 ]; then
        print_success "Playwright MCP server stopped successfully!"
    else
        print_error "Failed to stop Playwright MCP server"
        exit 1
    fi
}

# Function to show logs
show_logs() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_status "Showing Playwright MCP server logs (Press Ctrl+C to exit)..."
    $COMPOSE_CMD logs -f playwright-mcp
}

# Function to show status
show_status() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_status "Playwright MCP server status:"
    $COMPOSE_CMD ps
    
    # Check if container is running
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "playwright-mcp-server"; then
        print_success "Server is running"
        echo ""
        print_status "Testing server endpoint..."
        if curl -s -f http://localhost:8931/mcp > /dev/null 2>&1; then
            print_success "Server endpoint is responding"
        else
            print_warning "Server endpoint is not responding yet (may still be starting up)"
        fi
    else
        print_warning "Server is not running"
    fi
}

# Function to run health check
run_health_check() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_status "Running health check..."
    $COMPOSE_CMD --profile health-check up health-check
}

# Function to build
build_image() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_status "Building Playwright MCP Docker image..."
    $COMPOSE_CMD build
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully!"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Function to clean up
clean_up() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    print_warning "This will stop and remove all containers, networks, and volumes"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up..."
        $COMPOSE_CMD down -v --remove-orphans
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled"
    fi
}

# Main script logic
check_dependencies

case "${1:-help}" in
    start|up)
        start_service
        ;;
    stop|down)
        stop_service
        ;;
    restart)
        stop_service
        sleep 2
        start_service
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    health)
        run_health_check
        ;;
    build)
        build_image
        ;;
    clean)
        clean_up
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac



