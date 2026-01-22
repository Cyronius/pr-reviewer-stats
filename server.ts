/**
 * Development server that serves the React app and provides API endpoints
 * for refreshing PR data from Azure DevOps.
 */

import 'dotenv/config';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fetchPRData } from './fetch-pr-velocity';

const PORT = 3001;
const BUILD_DIR = path.join(__dirname, 'build');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStaticFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // CORS headers for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint to refresh PR data (uses SSE for progress updates)
  if (url === '/api/refresh' && req.method === 'POST') {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        let options: { withLoc?: boolean } = {};
        if (body) {
          try {
            options = JSON.parse(body);
          } catch {
            // ignore parse errors, use defaults
          }
        }

        console.log('Starting PR data refresh...');
        const csvContent = await fetchPRData({
          org: process.env.AZURE_DEVOPS_ORG || 'itkennel',
          outputPath: 'pr-velocity.csv',
          yearsBack: 2,
          withLoc: options.withLoc || false,
          onProgress: (repoName) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', repo: repoName })}\n\n`);
          }
        });

        // Send final event with CSV data
        res.write(`data: ${JSON.stringify({ type: 'complete', csv: csvContent })}\n\n`);
        res.end();
      } catch (error) {
        console.error('Refresh error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
        res.end();
      }
    });
    return;
  }

  // API endpoint to check if PAT is configured
  if (url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasPAT: !!process.env.AZURE_DEVOPS_PAT,
      org: process.env.AZURE_DEVOPS_ORG || 'itkennel'
    }));
    return;
  }

  // Serve static files
  let filePath: string;

  if (url === '/') {
    // Try build/index.html first, fall back to public/index.html
    filePath = fs.existsSync(path.join(BUILD_DIR, 'index.html'))
      ? path.join(BUILD_DIR, 'index.html')
      : path.join(PUBLIC_DIR, 'index.html');
  } else if (url === '/pr-velocity.csv') {
    // Serve CSV from project root
    filePath = path.join(__dirname, 'pr-velocity.csv');
  } else {
    // Try build directory first, then public
    const buildPath = path.join(BUILD_DIR, url);
    const publicPath = path.join(PUBLIC_DIR, url);

    if (fs.existsSync(buildPath)) {
      filePath = buildPath;
    } else if (fs.existsSync(publicPath)) {
      filePath = publicPath;
    } else {
      // SPA fallback - serve index.html for client-side routing
      filePath = fs.existsSync(path.join(BUILD_DIR, 'index.html'))
        ? path.join(BUILD_DIR, 'index.html')
        : path.join(PUBLIC_DIR, 'index.html');
    }
  }

  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /api/refresh - Refresh PR data from Azure DevOps`);
  console.log(`  GET  /api/status  - Check configuration status`);

  if (!process.env.AZURE_DEVOPS_PAT) {
    console.log('\nWarning: AZURE_DEVOPS_PAT not set. Refresh will fail.');
    console.log('Set it with: $env:AZURE_DEVOPS_PAT="your-pat-token"');
  }
});
