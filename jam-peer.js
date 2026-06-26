#!/usr/bin/env node
const { JAMOmni } = require('./jamkernelp2p.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

async function main() {
    const kernel = await JAMOmni.createKernel({});
    const id = await kernel.whenIdentityReady();
    const signalUrl = kernel.platform.getSignalingUrl();
    const signalPort = signalUrl ? parseInt(signalUrl.split(':')[2]) : null;

    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║     jamkernelp2p Mesh Peer                ║');
    console.log('  ║     Zero-dependency P2P mesh node        ║');
    console.log('  ╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`  🔑  Identity: ${id.peerId}`);
    console.log(`  🌐  Platform: ${kernel.platform.getPlatformName()}`);
    console.log(`  📡  Signal:   ${signalUrl || 'none'}`);
    console.log(`  🌍  Web:      http://localhost:${PORT}`);
    console.log('');

    // Wire up mesh events
    kernel.events.on('signal:peer_joined', ({ peerId }) => {
        console.log(`  ➕  Peer joined: ${peerId}`);
    });
    kernel.events.on('signal:peer_left', ({ peerId }) => {
        console.log(`  ➖  Peer left: ${peerId}`);
    });
    kernel.events.on('mesh:peer_discovered', ({ peerId }) => {
        console.log(`  🔍  Discovered: ${peerId}`);
    });
    kernel.events.on('signal:server_started', ({ url }) => {
        console.log(`  ✅  Signal server: ${url}`);
    });

    // Add HTTP file serving to the same server
    const httpServer = kernel.platform._httpServer;
    if (httpServer) {
        httpServer.on('request', (req, res) => {
            let filePath = req.url === '/' ? '/index.html' : req.url;
            filePath = path.join(PUBLIC_DIR, filePath);
            const ext = path.extname(filePath);
            const types = {
                '.html': 'text/html; charset=utf-8',
                '.js': 'text/javascript; charset=utf-8',
                '.css': 'text/css; charset=utf-8',
                '.json': 'application/json; charset=utf-8',
                '.png': 'image/png',
                '.ico': 'image/x-icon'
            };
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not found');
                    return;
                }
                res.writeHead(200, {
                    'Content-Type': types[ext] || 'application/octet-stream',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        });

        // If the signal server already started, listen on our port
        if (!httpServer.listening) {
            httpServer.listen(PORT, '0.0.0.0', () => {
                console.log(`  🌍  Serving:   http://localhost:${PORT}`);
                console.log('');
                console.log('  Open http://localhost:' + PORT + ' in your browser.');
                console.log('  Share the URL with others on your network.');
                console.log('');
            });
        }
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
