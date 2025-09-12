# Running Playwright MCP with Docker Compose

This guide explains how to run the Playwright MCP server using Docker Compose.

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd playwright-mcp
   ```

2. **Start the service:**
   ```bash
   docker-compose up -d
   ```

3. **The MCP server will be available at:**
   ```
   http://localhost:8931/mcp
   ```

## Configuration

### Environment Variables

Copy `docker.env` to `.env` and modify as needed:

```bash
cp docker.env .env
```

Key environment variables:
- `MCP_PORT`: Port for the MCP server (default: 8931)
- `BROWSER`: Browser to use (chromium, firefox, webkit)
- `HEADLESS`: Run in headless mode (true/false)
- `OUTPUT_DIR`: Directory for output files
- `CAPABILITIES`: Comma-separated capabilities (vision,pdf,tabs,install)

### JSON Configuration

For advanced configuration, copy and modify the JSON config:

```bash
cp config.json.example config.json
```

Then uncomment the config volume mount in `docker-compose.yml`.

## Usage

### Start the service
```bash
docker-compose up -d
```

### View logs
```bash
docker-compose logs -f playwright-mcp
```

### Stop the service
```bash
docker-compose down
```

### Rebuild after changes
```bash
docker-compose up -d --build
```

### Health Check
Run the health check service to verify the server is working:
```bash
docker-compose --profile health-check up health-check
```

## MCP Client Configuration

Once running, configure your MCP client to use the HTTP endpoint:

```json
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

For remote access, replace `localhost` with your server's IP address.

## Output Files

The service mounts an `output` directory where screenshots, PDFs, and other files will be saved:
- Local path: `./output`
- Container path: `/app/output`

## Capabilities

Enable additional capabilities by setting the `CAPABILITIES` environment variable:

- `vision`: Coordinate-based interactions (mouse clicks at x,y)
- `pdf`: PDF generation capabilities
- `tabs`: Tab management
- `install`: Browser installation tools

Example:
```bash
CAPABILITIES=pdf,tabs,vision
```

## Networking

The service runs on a dedicated Docker network (`playwright-network`) and can be accessed by other containers or from the host.

## Troubleshooting

### Container won't start
- Check if port 8931 is already in use
- Verify Docker and Docker Compose are installed
- Check logs: `docker-compose logs playwright-mcp`

### Permission issues
- Ensure the output directory is writable
- The container runs as the `node` user for security

### Browser issues
- The container only supports Chromium in headless mode
- For other browsers, run the server directly on the host

### Memory issues
- Increase Docker memory limits if needed
- Monitor with: `docker stats playwright-mcp-server`

## Development

To develop with the Docker setup:

1. **Mount source code for live reloading:**
   ```yaml
   volumes:
     - ./src:/app/src
     - ./lib:/app/lib
   ```

2. **Use development command:**
   ```yaml
   command: ["npm", "run", "watch"]
   ```

3. **Enable development ports:**
   ```yaml
   ports:
     - "9229:9229"  # Debug port
   ```



