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

const http = require('http');

/**
 * Adds healthcheck handler to an HTTP server using prependListener.
 * This ensures our healthcheck handler runs before other handlers.
 * After responding, we disable further writes to prevent subsequent handlers
 * from overwriting our response.
 */
function addHealthcheckHandler(server) {
  server.prependListener('request', (req, res) => {
    if (!req.url) {
      return;
    }

    try {
      const url = new URL(`http://localhost${req.url}`);
      
      // Handle healthcheck endpoints
      if ((url.pathname === '/health' || url.pathname === '/healthcheck') && req.method === 'GET') {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString() 
        }));
        
        // Prevent subsequent handlers from writing to the response
        // Node.js EventEmitter calls all listeners, so we need to disable
        // response methods to stop the playwright handler from overwriting
        res.write = () => true;
        res.end = () => res;
        res.writeHead = () => res;
        res.setHeader = () => res;
        
        return;
      }
    } catch (e) {
      // Invalid URL, let other handlers deal with it
    }
  });
}

/**
 * Patches Node.js http.createServer directly.
 * This is necessary because playwright-core exports are non-configurable getters
 * that can't be overwritten.
 */
function patchHttpModule() {
  const originalCreateServer = http.createServer;
  
  http.createServer = function(...args) {
    const server = originalCreateServer.apply(this, args);
    addHealthcheckHandler(server);
    return server;
  };
  
  // Copy over any properties from the original function
  Object.keys(originalCreateServer).forEach(key => {
    http.createServer[key] = originalCreateServer[key];
  });
}

// Apply the patch immediately
patchHttpModule();

module.exports = { addHealthcheckHandler, patchHttpModule };
