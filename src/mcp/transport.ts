/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import http from 'http';
import crypto from 'crypto';
import debug from 'debug';

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { httpAddressToString, startHttpServer } from '../utils/httpServer.js';
import * as mcpServer from './server.js';

import type { ServerBackendFactory } from './server.js';

export async function start(serverBackendFactory: ServerBackendFactory, options: { host?: string; port?: number }) {
  if (options.port !== undefined) {
    const httpServer = await startHttpServer(options);
    startHttpTransport(httpServer, serverBackendFactory);
  } else {
    await startStdioTransport(serverBackendFactory);
  }
}

async function startStdioTransport(serverBackendFactory: ServerBackendFactory) {
  await mcpServer.connect(serverBackendFactory, new StdioServerTransport(), false);
}

const testDebug = debug('pw:mcp:test');
const traceDebug = debug('pw:mcp:trace');

async function handleSSE(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, url: URL, sessions: Map<string, SSEServerTransport>) {
  if (req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      res.statusCode = 400;
      return res.end('Missing sessionId');
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      res.statusCode = 404;
      return res.end('Session not found');
    }

    return await transport.handlePostMessage(req, res);
  } else if (req.method === 'GET') {
    const transport = new SSEServerTransport('/sse', res);
    sessions.set(transport.sessionId, transport);
    traceDebug(`create SSE session: ${transport.sessionId}`);
    await mcpServer.connect(serverBackendFactory, transport, false);
    res.on('close', () => {
      traceDebug(`delete SSE session: ${transport.sessionId}`);
      sessions.delete(transport.sessionId);
    });
    return;
  }

  res.statusCode = 405;
  res.end('Method not allowed');
}

async function handleHealth(req: http.IncomingMessage, res: http.ServerResponse, sseSessions: Map<string, SSEServerTransport>, streamableSessions: Map<string, StreamableHTTPServerTransport>) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method not allowed');
    return;
  }

  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    sessions: {
      sse: sseSessions.size,
      streamable: streamableSessions.size,
      total: sseSessions.size + streamableSessions.size
    },
    memory: process.memoryUsage(),
    pid: process.pid
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(healthData, null, 2));
}

async function handleStreamable(serverBackendFactory: ServerBackendFactory, req: http.IncomingMessage, res: http.ServerResponse, sessions: Map<string, StreamableHTTPServerTransport>) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (sessionId) {
    let transport = sessions.get(sessionId);
    if (!transport) {
      const localTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessioninitialized: async (sessionId: string) => {
          testDebug(`create http session: ${sessionId}`);
          await mcpServer.connect(serverBackendFactory, localTransport, true);
        }
      });
  
      localTransport.onclose = () => {
        if (!localTransport.sessionId)
          return;
        sessions.delete(localTransport.sessionId);
        testDebug(`delete http session: ${localTransport.sessionId}`);
      };

      // Manually trigger initialization by setting internal properties
      // This mimics what happens during a normal initialization request
      (localTransport as any).sessionId = sessionId;
      (localTransport as any)._initialized = true;
      
      // Call the onsessioninitialized callback if provided
      if ((localTransport as any)._onsessioninitialized) {
        await Promise.resolve((localTransport as any)._onsessioninitialized(sessionId));
      }

      sessions.set(sessionId, localTransport);

      return await localTransport.handleRequest(req, res);
    }
    return await transport.handleRequest(req, res);
  }

  if (req.method === 'POST') {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: async sessionId => {
        testDebug(`create http session: ${transport.sessionId}`);
        await mcpServer.connect(serverBackendFactory, transport, true);
        sessions.set(sessionId, transport);
      }
    });

    transport.onclose = () => {
      if (!transport.sessionId)
        return;
      sessions.delete(transport.sessionId);
      testDebug(`delete http session: ${transport.sessionId}`);
    };

    await transport.handleRequest(req, res);
    return;
  }

  res.statusCode = 400;
  res.end('Invalid request');
}

function startHttpTransport(httpServer: http.Server, serverBackendFactory: ServerBackendFactory) {
  const sseSessions = new Map();
  const streamableSessions = new Map();
  httpServer.on('request', async (req, res) => {
    const url = new URL(`http://localhost${req.url}`);
    if (url.pathname === '/health')
      await handleHealth(req, res, sseSessions, streamableSessions);
    else if (url.pathname.startsWith('/sse'))
      await handleSSE(serverBackendFactory, req, res, url, sseSessions);
    else
      await handleStreamable(serverBackendFactory, req, res, streamableSessions);
  });
  const url = httpAddressToString(httpServer.address());
  const message = [
    `Listening on ${url}`,
    `Health check available at ${url}/health`,
    'Put this in your client config:',
    JSON.stringify({
      'mcpServers': {
        'playwright': {
          'url': `${url}/mcp`
        }
      }
    }, undefined, 2),
    'For legacy SSE transport support, you can use the /sse endpoint instead.',
  ].join('\n');
    // eslint-disable-next-line no-console
  console.error(message);
}
