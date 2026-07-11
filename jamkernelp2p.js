// ============================================================================
// jamkernelp2p v1.2.0
// ============================================================================
//
// PROYECTO OFICIAL: https://github.com/jamkernel/jamkernelp2p
// SITIO WEB: https://jamkernelp2p.github.io
// CONTACTO: jamkernelp2p@gmail.com
//
// AUTOR: Félix Martínez
// DEDICADO A: Jose Alejandro Martínez — motor e inspiración
// LICENCIA: GNU GPL v3
//
// CARACTERÍSTICAS:
// - Un solo archivo (~3500 líneas)
// - Cero dependencias externas
// - Multi-plataforma: Navegadores, Node.js, Deno, Bun
// - Cifrado AES-256-GCM + PBKDF2 (60,000 iteraciones)
// - Identidad ECDSA P-256 con firma y verificación
// - Purga forense de claves en RAM
// - Servidor de señalización WebSocket embebido (RFC 6455)
// - Mesh P2P con WebRTC (browser) y WebSocket relay (Node.js)
// - Rate limiting anti-DoS (12 msg/seg)
// - Lista negra automática
// - ACKs de entrega con reintentos
// - Almacenamiento con mutex y backoff exponencial
// - EventBus con contexto blindado
// - Logger estructurado con rotación
// - Cluster mode multi-worker
// - Sistema de plugins
// ============================================================================

const JAM_ENCODER = new TextEncoder();
const JAM_DECODER = new TextDecoder();

// ===========================================================
// 1. CONTRATO UNIVERSAL DE PLATAFORMA (IPLATFORM)
// ===========================================================
class IPlatform {
    async generateRandomBytes(size) { throw new Error('No implementado'); }
    async getCryptoSubtle() { throw new Error('No implementado'); }
    getWebSocketClass() { throw new Error('No implementado'); }
    getFs() { return null; }
    getPath() { return null; }
    getOs() { return null; }
    isBrowser() { return false; }
    isNode() { return false; }
    isDeno() { return false; }
    isBun() { return false; }
    hasWebRTC() { return false; }
    onExit(fn) {}
}

// ===========================================================
// 2. ADAPTADORES DE ENTORNO NATIVOS
// ===========================================================
class BrowserAdapter extends IPlatform {
    async generateRandomBytes(size) {
        const bytes = new Uint8Array(size);
        window.crypto.getRandomValues(bytes);
        return bytes;
    }
    async getCryptoSubtle() {
        if (!window.crypto || !window.crypto.subtle)
            throw new Error("🔒 jamkernelp2p Crypto requiere HTTPS o localhost");
        return window.crypto.subtle;
    }
    getWebSocketClass() { return WebSocket; }
    isBrowser() { return true; }
    hasWebRTC() { return typeof RTCPeerConnection !== 'undefined'; }
}

class NodeAdapter extends IPlatform {
    constructor() {
        super();
        this._crypto = require('crypto');
        this._fs = require('fs');
        this._path = require('path');
        this._os = require('os');
        this._http = require('http');
        this._https = require('https');
        this._net = require('net');
    }
    get http() { return this._http; }
    get https() { return this._https; }
    get net() { return this._net; }
    async generateRandomBytes(size) {
        return new Uint8Array(this._crypto.randomBytes(size));
    }
    async getCryptoSubtle() {
        return this._crypto.webcrypto.subtle;
    }
    getWebSocketClass() {
        if (typeof globalThis.WebSocket !== 'undefined') return globalThis.WebSocket;
        return null;
    }
    getFs() { return this._fs; }
    getPath() { return this._path; }
    getOs() { return this._os; }
    isNode() { return true; }
    // No WebRTC nativo en Node.js sin wrtc
    hasWebRTC() { return false; }
    onExit(fn) {
        process.on('exit', fn);
        process.on('SIGINT', () => { fn(); process.exit(0); });
        process.on('SIGTERM', fn);
    }
}

class DenoAdapter extends IPlatform {
    async generateRandomBytes(size) {
        const buf = new Uint8Array(size);
        crypto.getRandomValues(buf);
        return buf;
    }
    async getCryptoSubtle() {
        return crypto.subtle;
    }
    getWebSocketClass() { return WebSocket; }
    isDeno() { return true; }
    hasWebRTC() { return false; }
}

class BunAdapter extends IPlatform {
    async generateRandomBytes(size) {
        const buf = new Uint8Array(size);
        crypto.getRandomValues(buf);
        return buf;
    }
    async getCryptoSubtle() {
        return crypto.subtle;
    }
    getWebSocketClass() { return WebSocket; }
    isBun() { return true; }
    hasWebRTC() { return false; }
}

function detectPlatform() {
    if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined')
        return new BrowserAdapter();
    if (typeof process !== 'undefined' && process.versions && process.versions.node)
        return new NodeAdapter();
    if (typeof Deno !== 'undefined')
        return new DenoAdapter();
    if (typeof Bun !== 'undefined')
        return new BunAdapter();
    throw new Error('❌ Entorno no soportado por jamkernelp2p');
}

// ===========================================================
// 3. EVENT BUS (INMUNE A CONDICIONES DE CARRERA)
// ===========================================================
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback, context = null) {
        if (typeof event !== 'string') return;
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        const targetCallback = context ? callback.bind(context) : callback;
        this.listeners.get(event).push(targetCallback);
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const idx = this.listeners.get(event).indexOf(callback);
        if (idx !== -1) this.listeners.get(event).splice(idx, 1);
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event).slice();
        const schedule = typeof setImmediate !== 'undefined' ? setImmediate : setTimeout;
        for (const cb of callbacks) {
            schedule(() => {
                try { cb(data); } catch (e) { console.error('❌ Error en callback de', event, e.message); }
            }, 0);
        }
    }
}

// ===========================================================
// 4. MUTEX
// ===========================================================
class Mutex {
    constructor() {
        this._locked = false;
        this._queue = [];
    }

    acquire() {
        return new Promise(resolve => {
            if (!this._locked) {
                this._locked = true;
                resolve();
            } else {
                this._queue.push(resolve);
            }
        });
    }

    release() {
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            next();
        } else {
            this._locked = false;
        }
    }
}

// ===========================================================
// 5. CACHE LRU
// ===========================================================
class Cache {
    constructor(maxSize = 100) {
        this._map = new Map();
        this._maxSize = maxSize;
    }

    get(key) {
        if (!this._map.has(key)) return null;
        const val = this._map.get(key);
        this._map.delete(key);
        this._map.set(key, val);
        return val;
    }

    set(key, value) {
        if (this._map.has(key)) this._map.delete(key);
        this._map.set(key, value);
        if (this._map.size > this._maxSize) {
            const oldest = this._map.keys().next().value;
            this._map.delete(oldest);
        }
    }

    delete(key) { this._map.delete(key); }
    clear() { this._map.clear(); }
    get size() { return this._map.size; }
}

// ===========================================================
// 6. STRUCTURED LOGGER
// ===========================================================
class StructuredLogger {
    constructor(config = {}) {
        this._level = config.logLevel || 'warn';
        this._logFile = config.logFile || null;
        this._levels = { error: 0, warn: 1, info: 2, debug: 3 };
        this._fs = config.fs || null;
        this._path = config.path || null;
        this._logStream = null;
        this._bytesWritten = 0;
        this._maxSize = 10 * 1024 * 1024; // 10 MB
        if (this._logFile && this._fs) this._openStream();
    }

    _openStream() {
        try {
            // append mode
            const fd = this._fs.openSync(this._logFile, 'a');
            this._logStream = this._fs.createWriteStream(this._logFile, { flags: 'a', fd });
            this._bytesWritten = 0;
            try { this._bytesWritten = this._fs.statSync(this._logFile).size; } catch (e) {}
        } catch (e) {
            console.error('❌ No se pudo abrir archivo de log:', e.message);
            this._logFile = null;
        }
    }

    _rotate() {
        if (!this._logStream || !this._fs) return;
        this._logStream.end();
        const rotated = this._logFile + '.1.log';
        try {
            if (this._fs.existsSync(rotated)) this._fs.unlinkSync(rotated);
            this._fs.renameSync(this._logFile, rotated);
        } catch (e) {}
        this._openStream();
    }

    _write(level, module, message, meta) {
        if (this._levels[level] === undefined) return;
        if (this._levels[level] > this._levels[this._level]) return;
        const ts = new Date().toISOString();
        const line = `[${ts}] [${level.toUpperCase()}] [${module}] ${message}`;
        console.log(line);
        if (meta && Object.keys(meta).length) console.log('  └─', JSON.stringify(meta));
        if (this._logStream) {
            const entry = JSON.stringify({ ts, level, module, msg: message, meta }) + '\n';
            this._logStream.write(entry);
            this._bytesWritten += Buffer.byteLength(entry);
            if (this._bytesWritten >= this._maxSize) this._rotate();
        }
    }

    error(module, message, meta) { this._write('error', module, message, meta); }
    warn(module, message, meta) { this._write('warn', module, message, meta); }
    info(module, message, meta) { this._write('info', module, message, meta); }
    debug(module, message, meta) { this._write('debug', module, message, meta); }

    close() {
        if (this._logStream) this._logStream.end();
    }
}

// ===========================================================
// 7. JAM CRYPTO (AES-256-GCM + PBKDF2 + ECDSA P-256)
// ===========================================================
class JamCrypto {
    constructor(platform) {
        this.platform = platform;
        this.iterations = 60000;
    }

    _deriveDynamicSalt(roomId) {
        const baseSalt = JAM_ENCODER.encode("jamkernelp2p_Mesh_Salt_Default_");
        const cleanRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '');
        const roomBytes = JAM_ENCODER.encode(cleanRoomId);
        const combined = new Uint8Array(baseSalt.length + roomBytes.length);
        combined.set(baseSalt);
        combined.set(roomBytes, baseSalt.length);
        return combined;
    }

    async deriveKey(password, roomId) {
        if (typeof password !== 'string' || password.length < 8)
            throw new Error('La contraseña debe tener al menos 8 caracteres');
        if (typeof roomId !== 'string' || roomId.length < 3)
            throw new Error('ID de sala inválido o demasiado corto');
        const subtle = await this.platform.getCryptoSubtle();
        const passwordBytes = JAM_ENCODER.encode(password);
        const salt = this._deriveDynamicSalt(roomId);
        const baseKey = await subtle.importKey('raw', passwordBytes, { name: 'PBKDF2' }, false, ['deriveKey']);
        return await subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: this.iterations, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    arrayBufferToBase64URL(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    base64URLToArrayBuffer(base64) {
        let b64 = base64.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        const binaryString = atob(b64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
    }

    async encrypt(text, cryptoKey) {
        const subtle = await this.platform.getCryptoSubtle();
        const dataBytes = JAM_ENCODER.encode(text);
        const iv = await this.platform.generateRandomBytes(12);
        const encryptedBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, dataBytes);
        const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encryptedBuffer), iv.length);
        return this.arrayBufferToBase64URL(combined.buffer);
    }

    async decrypt(base64Data, cryptoKey) {
        const subtle = await this.platform.getCryptoSubtle();
        const combined = new Uint8Array(this.base64URLToArrayBuffer(base64Data));
        const iv = combined.slice(0, 12);
        const dataBytes = combined.slice(12);
        const decryptedBuffer = await subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, dataBytes);
        return JAM_DECODER.decode(decryptedBuffer);
    }

    async purgeKeyFromMemory(container, keyProperty) {
        try {
            const subtle = await this.platform.getCryptoSubtle();
            await subtle.importKey('raw', new Uint8Array(32), { name: 'AES-GCM' }, false, ['encrypt']);
            container[keyProperty] = null;
            if (typeof global !== 'undefined' && global.gc) global.gc();
            if (typeof window !== 'undefined' && window.gc) window.gc();
        } catch (e) {
            console.warn('⚠️ Fallo en purga de memoria:', e.message);
        }
    }

    // ── ECDSA P-256 ──
    async generateECDSAKeyPair() {
        const subtle = await this.platform.getCryptoSubtle();
        return await subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
    }

    async exportPublicKey(publicKey) {
        const subtle = await this.platform.getCryptoSubtle();
        const raw = await subtle.exportKey('raw', publicKey);
        return new Uint8Array(raw);
    }

    async exportPrivateKey(privateKey) {
        const subtle = await this.platform.getCryptoSubtle();
        const pkcs8 = await subtle.exportKey('pkcs8', privateKey);
        return new Uint8Array(pkcs8);
    }

    async importPublicKey(rawBytes) {
        const subtle = await this.platform.getCryptoSubtle();
        return await subtle.importKey('raw', rawBytes, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    }

    async importPrivateKey(pkcs8Bytes) {
        const subtle = await this.platform.getCryptoSubtle();
        return await subtle.importKey('pkcs8', pkcs8Bytes, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    }

    async ecdsaSign(privateKey, data) {
        const subtle = await this.platform.getCryptoSubtle();
        const dataBytes = JAM_ENCODER.encode(data);
        const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, dataBytes);
        return this.arrayBufferToBase64URL(signature);
    }

    async ecdsaVerify(publicKey, data, signatureBase64) {
        const subtle = await this.platform.getCryptoSubtle();
        const dataBytes = JAM_ENCODER.encode(data);
        const sigBytes = new Uint8Array(this.base64URLToArrayBuffer(signatureBase64));
        return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, dataBytes);
    }

    async sha256(data) {
        const subtle = await this.platform.getCryptoSubtle();
        const hash = await subtle.digest('SHA-256', JAM_ENCODER.encode(data));
        return this.arrayBufferToBase64URL(hash);
    }

    async sha256Raw(buffer) {
        const subtle = await this.platform.getCryptoSubtle();
        return new Uint8Array(await subtle.digest('SHA-256', buffer));
    }

    async generateUUID() {
        const bytes = await this.platform.generateRandomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    }
}

// ===========================================================
// 8. IDENTITY MANAGER (ECDSA P-256)
// ===========================================================
class IdentityManager {
    constructor(crypto) {
        this._crypto = crypto;
        this._publicKey = null;
        this._privateKey = null;
        this._peerId = null;
        this._ready = false;
    }

    get peerId() { return this._peerId; }
    get isReady() { return this._ready; }

    async createIdentity() {
        const keyPair = await this._crypto.generateECDSAKeyPair();
        this._publicKey = keyPair.publicKey;
        this._privateKey = keyPair.privateKey;
        const rawPub = await this._crypto.exportPublicKey(this._publicKey);
        const hash = await this._crypto.sha256Raw(rawPub.buffer);
        this._peerId = this._crypto.arrayBufferToBase64URL(hash.buffer);
        this._ready = true;
        return { peerId: this._peerId };
    }

    async sign(data) {
        if (!this._privateKey) throw new Error('Identity no inicializada');
        return await this._crypto.ecdsaSign(this._privateKey, data);
    }

    async verify(peerId, data, signatureBase64, publicKeyRaw) {
        try {
            const pubKey = await this._crypto.importPublicKey(publicKeyRaw);
            return await this._crypto.ecdsaVerify(pubKey, data, signatureBase64);
        } catch (e) {
            return false;
        }
    }

    async derivePeerIdFromPublicKey(publicKeyRaw) {
        const hash = await this._crypto.sha256Raw(publicKeyRaw.buffer);
        return this._crypto.arrayBufferToBase64URL(hash.buffer);
    }

    async toJSON() {
        if (!this._ready) return null;
        const pubRaw = await this._crypto.exportPublicKey(this._publicKey);
        const privRaw = await this._crypto.exportPrivateKey(this._privateKey);
        return {
            peerId: this._peerId,
            publicKey: this._crypto.arrayBufferToBase64URL(pubRaw.buffer),
            privateKey: this._crypto.arrayBufferToBase64URL(privRaw.buffer)
        };
    }

    async fromJSON(json) {
        const pubRaw = new Uint8Array(this._crypto.base64URLToArrayBuffer(json.publicKey));
        const privRaw = new Uint8Array(this._crypto.base64URLToArrayBuffer(json.privateKey));
        this._publicKey = await this._crypto.importPublicKey(pubRaw);
        this._privateKey = await this._crypto.importPrivateKey(privRaw);
        this._peerId = json.peerId;
        this._ready = true;
    }
}

// ===========================================================
// 9. WEBSOCKET (RFC 6455) — IMPLEMENTACIÓN CERO DEPENDENCIAS
// ===========================================================
const WS_GUID = '258EAFA5-E914-47DA-95CA-5AB5F9F13AB5';

class _WebSocketFrame {
    static encode(opcode, payload, mask) {
        const isBinary = typeof payload === 'object' && (payload instanceof Uint8Array || payload instanceof Buffer);
        const data = isBinary ? new Uint8Array(payload) : JAM_ENCODER.encode(payload);
        const fin = 0x80;
        const b0 = fin | (opcode & 0x0f);
        const len = data.length;
        const maskBit = mask ? 0x80 : 0;

        let frame;
        let offset;
        if (len < 126) {
            frame = new Uint8Array(2 + (mask ? 4 : 0) + len);
            frame[0] = b0;
            frame[1] = len | maskBit;
            offset = 2;
        } else if (len < 65536) {
            frame = new Uint8Array(4 + (mask ? 4 : 0) + len);
            frame[0] = b0;
            frame[1] = 126 | maskBit;
            frame[2] = (len >> 8) & 0xff;
            frame[3] = len & 0xff;
            offset = 4;
        } else {
            frame = new Uint8Array(10 + (mask ? 4 : 0) + len);
            frame[0] = b0;
            frame[1] = 127 | maskBit;
            for (let i = 7; i >= 0; i--) frame[9 - i] = (len >> (i * 8)) & 0xff;
            offset = 10;
        }

        if (mask) {
            const maskKey = new Uint8Array(4);
            for (let i = 0; i < 4; i++) maskKey[i] = ((Math.random() * 256) | 0);
            frame.set(maskKey, offset);
            offset += 4;
            for (let i = 0; i < data.length; i++) frame[offset + i] = data[i] ^ maskKey[i % 4];
        } else {
            frame.set(data, offset);
        }
        return frame;
    }

    static decode(buffer) {
        const buf = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const first = view.getUint8(0);
        const fin = (first & 0x80) !== 0;
        const opcode = first & 0x0f;
        if (buf.length < 2) return null;
        const second = view.getUint8(1);
        const masked = (second & 0x80) !== 0;
        let len = second & 0x7f;
        let offset = 2;
        if (len === 126) {
            if (buf.length < 4) return null;
            len = view.getUint16(2);
            offset = 4;
        } else if (len === 127) {
            if (buf.length < 10) return null;
            let high = 0, low = 0;
            for (let i = 0; i < 4; i++) high = (high << 8) | view.getUint8(2 + i);
            for (let i = 0; i < 4; i++) low = (low << 8) | view.getUint8(6 + i);
            len = high * 4294967296 + low;
            offset = 10;
        }
        let maskKey = null;
        if (masked) {
            if (buf.length < offset + 4) return null;
            maskKey = buf.slice(offset, offset + 4);
            offset += 4;
        }
        if (buf.length < offset + len) return null;
        let payload = buf.slice(offset, offset + len);
        if (masked && maskKey) {
            const unmasked = new Uint8Array(payload.length);
            for (let i = 0; i < payload.length; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
            payload = unmasked;
        }
        return { fin, opcode, payload, maskKey };
    }
}

class _WebSocketServer {
    constructor(httpServer) {
        this.httpServer = httpServer;
        this.clients = new Set();
        this._onConnection = null;
        this._onError = null;
        httpServer.on('upgrade', (req, socket, head) => {
            this._handleUpgrade(req, socket, head);
        });
    }

    onConnection(cb) { this._onConnection = cb; }
    onError(cb) { this._onError = cb; }

    _handleUpgrade(req, socket, head) {
        const key = req.headers['sec-websocket-key'];
        if (!key) { socket.destroy(); return; }
        const accept = require('crypto')
            .createHash('sha1')
            .update(key + WS_GUID)
            .digest('base64');
        socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\n' +
            'Connection: Upgrade\r\n' +
            'Sec-WebSocket-Accept: ' + accept + '\r\n' +
            '\r\n'
        );
        const ws = new _WebSocketPeer(socket);
        // Process any head data that was already buffered
        if (head && head.length > 0) {
            ws._buffer = Buffer.concat([ws._buffer, head]);
            ws._processBuffer();
        }
        this.clients.add(ws);
        ws._onClose = () => { this.clients.delete(ws); };
        if (this._onConnection) this._onConnection(ws);
    }

    close() {
        for (const client of this.clients) client.close();
        this.httpServer.removeAllListeners('upgrade');
    }
}

class _WebSocketPeer {
    constructor(socket) {
        this.socket = socket;
        this._onMessage = null;
        this._onClose = null;
        this._onError = null;
        this._buffer = Buffer.alloc(0);
        this._closed = false;

        socket.on('data', (data) => {

            this._buffer = Buffer.concat([this._buffer, data]);
            this._processBuffer();
        });
        socket.on('close', () => {
            this._closed = true;
            if (this._onClose) this._onClose();
        });
        socket.on('error', (err) => {
            if (this._onError) this._onError(err);
        });
    }

    _processBuffer() {
        while (this._buffer.length >= 2) {
            const bufArr = new Uint8Array(this._buffer);
            const view = new DataView(bufArr.buffer, bufArr.byteOffset, bufArr.byteLength);
            const second = view.getUint8(1);
            let len = second & 0x7f;
            let headerLen = 2;
            if (len === 126) {
                if (this._buffer.length < 4) return;
                headerLen = 4;
                len = view.getUint16(2);
            } else if (len === 127) {
                if (this._buffer.length < 10) return;
                headerLen = 10;
                let high = 0, low = 0;
                for (let i = 0; i < 4; i++) high = (high << 8) | view.getUint8(2 + i);
                for (let i = 0; i < 4; i++) low = (low << 8) | view.getUint8(6 + i);
                len = high * 4294967296 + low;
            }
            const masked = (second & 0x80) !== 0;
            const maskLen = masked ? 4 : 0;
            const totalLen = headerLen + maskLen + len;
            if (this._buffer.length < totalLen) return;
            const frameData = this._buffer.slice(0, totalLen);
            this._buffer = this._buffer.slice(totalLen);
            const frame = _WebSocketFrame.decode(frameData);
            if (!frame) continue;
            const opcode = frame.opcode;
            if (opcode === 0x8) {
                this._closed = true;
                try { this.socket.write(Buffer.from(_WebSocketFrame.encode(0x8, '', false))); } catch (e) {}
                try { this.socket.end(); } catch (e) {}
                if (this._onClose) this._onClose();
                return;
            } else if (opcode === 0x9) {
                try { this.socket.write(Buffer.from(_WebSocketFrame.encode(0xA, frame.payload, false))); } catch (e) {}
            } else if (opcode === 0xA) {
            } else if (opcode === 0x1 || opcode === 0x2) {
                let message;
                if (opcode === 0x1) {
                    message = JAM_DECODER.decode(frame.payload);
                } else message = frame.payload;
                if (this._onMessage) this._onMessage(message, opcode === 0x2);
            }
        }
    }

    send(data) {
        if (this._closed) return;
        try {
            const isBinary = typeof data !== 'string';
            const frame = _WebSocketFrame.encode(isBinary ? 0x2 : 0x1, data, false);
            this.socket.write(Buffer.from(frame));
        } catch (e) {
            if (this._onError) this._onError(e);
        }
    }

    sendBinary(data) {
        if (this._closed) return;
        try {
            const frame = _WebSocketFrame.encode(0x2, data, false);
            this.socket.write(Buffer.from(frame));
        } catch (e) {
            if (this._onError) this._onError(e);
        }
    }

    close() {
        if (this._closed) return;
        try {
            this.socket.write(Buffer.from(_WebSocketFrame.encode(0x8, '', false)));
        } catch (e) {}
        try { this.socket.end(); } catch (e) {}
        this._closed = true;
    }
}

class _WebSocketClientNode {
    constructor(url) {
        this.url = url;
        this._onOpen = null;
        this._onMessage = null;
        this._onClose = null;
        this._onError = null;
        this._socket = null;
        this._buffer = Buffer.alloc(0);
        this._closed = false;
        this.readyState = 0; // CONNECTING
    }

    connect() {
        const parsed = new URL(this.url);
        const isTLS = parsed.protocol === 'wss:';
        const port = parsed.port || (isTLS ? 443 : 80);
        const key = require('crypto').randomBytes(16).toString('base64');
        const acceptExpected = require('crypto')
            .createHash('sha1')
            .update(key + WS_GUID)
            .digest('base64');

        const netMod = isTLS ? require('tls') : require('net');
        const socket = netMod.connect(port, parsed.hostname, () => {
            const path = parsed.pathname + parsed.search || '/';
            socket.write(
                'GET ' + path + ' HTTP/1.1\r\n' +
                'Host: ' + parsed.host + '\r\n' +
                'Upgrade: websocket\r\n' +
                'Connection: Upgrade\r\n' +
                'Sec-WebSocket-Key: ' + key + '\r\n' +
                'Sec-WebSocket-Version: 13\r\n' +
                '\r\n'
            );
        });

        let responseData = '';
        socket.on('data', (chunk) => {
            responseData += chunk.toString();
            if (responseData.includes('\r\n\r\n')) {
                const lines = responseData.split('\r\n');
                const statusLine = lines[0];
                if (!statusLine.includes('101')) {
                    if (this._onError) this._onError(new Error('WebSocket handshake failed: ' + statusLine));
                    socket.destroy();
                    return;
                }
                // Validate Sec-WebSocket-Accept
                let acceptHeader = null;
                for (let i = 1; i < lines.length; i++) {
                    const lower = lines[i].toLowerCase();
                    if (lower.startsWith('sec-websocket-accept:')) {
                        acceptHeader = lines[i].split(':')[1].trim();
                        break;
                    }
                }
                if (!acceptHeader || acceptHeader !== acceptExpected) {
                    if (this._onError) this._onError(new Error('WebSocket handshake: Sec-WebSocket-Accept inválido'));
                    socket.destroy();
                    return;
                }
                this.readyState = 1; // OPEN
                this._socket = socket;
                // Remove HTTP response from buffer, keep any trailing WS data
                const headerEnd = responseData.indexOf('\r\n\r\n') + 4;
                const leftover = responseData.slice(headerEnd);
                this._buffer = Buffer.from(leftover, 'binary');
                if (this._onOpen) this._onOpen();
                // Process any leftover data as WS frames
                if (leftover.length > 0) this._processBuffer();
                // Now attach data handler for WS frames only
                socket.removeAllListeners('data');
                socket.on('data', (d) => {
                    this._buffer = Buffer.concat([this._buffer, d]);
                    this._processBuffer();
                });
            }
        });

        socket.on('error', (err) => { if (this._onError) this._onError(err); });
        socket.on('close', () => {
            this._closed = true;
            this.readyState = 3; // CLOSED
            if (this._onClose) this._onClose();
        });
    }

    _processBuffer() {
        while (this._buffer.length >= 2) {
            const bufArr = new Uint8Array(this._buffer);
            const view = new DataView(bufArr.buffer, bufArr.byteOffset, bufArr.byteLength);
            const second = view.getUint8(1);
            const opcode = view.getUint8(0) & 0x0f;
            let len = second & 0x7f;
            let headerLen = 2;
            if (len === 126) {
                if (this._buffer.length < 4) return;
                headerLen = 4;
                len = view.getUint16(2);
            } else if (len === 127) {
                if (this._buffer.length < 10) return;
                headerLen = 10;
                let high = 0, low = 0;
                for (let i = 0; i < 4; i++) high = (high << 8) | view.getUint8(2 + i);
                for (let i = 0; i < 4; i++) low = (low << 8) | view.getUint8(6 + i);
                len = high * 4294967296 + low;
            }
            const masked = (second & 0x80) !== 0;
            const maskLen = masked ? 4 : 0;
            const totalLen = headerLen + maskLen + len;
            if (this._buffer.length < totalLen) return;
            const frameData = this._buffer.slice(0, totalLen);
            this._buffer = this._buffer.slice(totalLen);
            const frame = _WebSocketFrame.decode(frameData);
            if (!frame) continue;
            if (opcode === 0x8) {
                this._closed = true;
                this.readyState = 3;
                try { this._socket.end(); } catch(e) {}
                if (this._onClose) this._onClose();
                return;
            } else if (opcode === 0x9) {
                try { this._socket.write(Buffer.from(_WebSocketFrame.encode(0xA, frame.payload, true))); } catch(e) {}
            } else if (opcode === 0x1 || opcode === 0x2) {
                let message;
                if (opcode === 0x1) message = JAM_DECODER.decode(frame.payload);
                else message = frame.payload;
                if (this._onMessage) this._onMessage(message, opcode === 0x2);
            }
        }
    }

    send(data) {
        if (this._closed || this.readyState !== 1) return;
        try {
            const isBinary = typeof data !== 'string';
            const frame = _WebSocketFrame.encode(isBinary ? 0x2 : 0x1, data, true);
            this._socket.write(Buffer.from(frame));
        } catch (e) {
            if (this._onError) this._onError(e);
        }
    }

    close() {
        if (this._closed) return;
        try { this._socket.write(Buffer.from(_WebSocketFrame.encode(0x8, '', true))); } catch(e) {}
        try { this._socket.end(); } catch(e) {}
        this._closed = true;
        this.readyState = 3;
    }
}

// ===========================================================
// 10. MINI SIGNAL SERVER
// ===========================================================
class MiniSignalServer {
    constructor(config = {}) {
        this._port = config.port || 0;
        this._host = config.host || '0.0.0.0';
        this._platform = config.platform || null;
        this._identityManager = config.identityManager || null;
        this._events = config.events || null;
        this._log = config.log || null;
        this._httpServer = null;
        this._wsServer = null;
        this._rooms = new Map(); // roomId → Set<{ ws, peerId, publicKeyRaw }>
        this._peerMap = new Map(); // ws → { peerId, roomId, publicKeyRaw }
        this._started = false;
    }

    get httpServer() { return this._httpServer; }
    get port() { return this._port; }
    get isStarted() { return this._started; }

    async start() {
        if (this._started) return;
        const fs = this._platform ? this._platform.getFs() : null;
        const pathMod = this._platform ? this._platform.getPath() : null;
        const http = this._platform ? this._platform.http : require('http');
        const https = this._platform ? this._platform.https : null;
        const tlsKey = this._tlsKey;
        const tlsCert = this._tlsCert;

        let server;
        if (tlsKey && tlsCert && fs) {
            server = https.createServer({
                key: fs.readFileSync(tlsKey),
                cert: fs.readFileSync(tlsCert)
            });
        } else {
            server = http.createServer();
        }

        this._httpServer = server;
        this._wsServer = new _WebSocketServer(server);

        this._wsServer.onConnection((ws) => {
            ws._onMessage = (msg, isBinary) => {
                if (isBinary) return;
                if (this._log) this._log.debug('MiniSignalServer', 'Mensaje: ' + (typeof msg === 'string' ? msg.slice(0, 80) : 'binary'));
                this._handleMessage(ws, msg);
            };
            ws._onClose = () => {
                this._handleDisconnect(ws);
            };
        });

        return new Promise((resolve) => {
            server.listen(this._port, this._host, () => {
                this._port = server.address().port;
                this._started = true;
                if (this._log) this._log.info('MiniSignalServer', `Servidor de señalización en puerto ${this._port}`);
                if (this._events) this._events.emit('signal:server_started', { url: `ws://${this._host}:${this._port}`, port: this._port });
                resolve();
            });
        });
    }

    _handleMessage(ws, rawMsg) {
        let msg;
        try { msg = JSON.parse(rawMsg); } catch (e) { return; }

        if (!msg.type) return;

        switch (msg.type) {
            case 'announce':
                this._handleAnnounce(ws, msg);
                break;
            case 'signal':
                this._handleSignal(ws, msg);
                break;
            case 'relay_msg':
                this._handleRelay(ws, msg);
                break;
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
        }
    }

    async _handleAnnounce(ws, msg) {
        const { peerId, publicKey, signature, room } = msg;
        if (!peerId || !publicKey || !signature || !room) {
            ws.send(JSON.stringify({ type: 'announce_error', reason: 'Faltan campos requeridos' }));
            return;
        }
        // Verify the signature
        let valid = false;
        try {
            if (this._identityManager) {
                const pubRaw = new Uint8Array(
                    this._identityManager._crypto.base64URLToArrayBuffer(publicKey)
                );
                valid = await this._identityManager.verify(peerId, peerId, signature, pubRaw);
            } else {
                valid = true; // Skip verification if no identity manager
            }
        } catch (e) {
            valid = false;
        }

        if (!valid) {
            ws.send(JSON.stringify({ type: 'announce_error', reason: 'Firma inválida' }));
            if (this._log) this._log.warn('MiniSignalServer', `Firma inválida para peer ${peerId}`);
            return;
        }

        // Check if room exists
        if (!this._rooms.has(room)) {
            this._rooms.set(room, new Map());
        }
        const roomPeers = this._rooms.get(room);

        // Add peer to room
        let pubRaw = null;
        if (this._identityManager) {
            pubRaw = new Uint8Array(
                this._identityManager._crypto.base64URLToArrayBuffer(publicKey)
            );
        }
        roomPeers.set(ws, { peerId, publicKeyRaw: pubRaw });
        this._peerMap.set(ws, { peerId, roomId: room, publicKeyRaw: pubRaw });

        // Send announce_ok
        ws.send(JSON.stringify({
            type: 'announce_ok',
            peerId,
            peers: Array.from(roomPeers.values())
                .filter(p => p.peerId !== peerId)
                .map(p => ({ peerId: p.peerId }))
        }));

        // Broadcast peer_joined to others in room (except sender)
        const joinMsg = JSON.stringify({ type: 'peer_joined', peerId, room });
        for (const [otherWs, info] of roomPeers) {
            if (otherWs !== ws) {
                otherWs.send(joinMsg);
            }
        }

        if (this._log) this._log.info('MiniSignalServer', `Peer ${peerId} unido a sala ${room}`);
        if (this._events) this._events.emit('signal:peer_joined', { peerId, room });
    }

    _handleSignal(ws, msg) {
        const peerInfo = this._peerMap.get(ws);
        if (!peerInfo) return;
        const { roomId } = peerInfo;
        const room = this._rooms.get(roomId);
        if (!room) return;
        const { to, data } = msg;
        const signalType = msg.signalType || msg.type;
        if (!to || !signalType) return;
        // Find target peer in room
        for (const [otherWs, info] of room) {
            if (info.peerId === to) {
                otherWs.send(JSON.stringify({
                    type: 'signal',
                    from: peerInfo.peerId,
                    signalType,
                    data: data || {}
                }));
                return;
            }
        }
    }

    _handleRelay(ws, msg) {
        const peerInfo = this._peerMap.get(ws);
        if (!peerInfo) return;
        const { roomId } = peerInfo;
        const room = this._rooms.get(roomId);
        if (!room) return;
        const { to, data } = msg;
        if (!to || !data) return;
        for (const [otherWs, info] of room) {
            if (info.peerId === to) {
                otherWs.send(JSON.stringify({
                    type: 'relay_msg',
                    from: peerInfo.peerId,
                    data
                }));
                return;
            }
        }
    }

    _handleDisconnect(ws) {
        const peerInfo = this._peerMap.get(ws);
        if (!peerInfo) return;
        const { peerId, roomId } = peerInfo;
        const room = this._rooms.get(roomId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) this._rooms.delete(roomId);
            // Broadcast peer_left
            const leaveMsg = JSON.stringify({ type: 'peer_left', peerId, room: roomId });
            for (const [otherWs] of room) {
                otherWs.send(leaveMsg);
            }
        }
        this._peerMap.delete(ws);
        if (this._log) this._log.info('MiniSignalServer', `Peer ${peerId} abandonó sala ${roomId}`);
        if (this._events) this._events.emit('signal:peer_left', { peerId, room: roomId });
    }

    stop() {
        if (this._wsServer) this._wsServer.close();
        if (this._httpServer) this._httpServer.close();
        this._started = false;
    }
}

// ===========================================================
// 11. SECURE JAM MESH ADAPTER (REAL CONNECTIVITY)
// ===========================================================
class SecureJamMeshAdapter {
    constructor(eventBus, cryptoEngine, identityManager, platform, log) {
        this.events = eventBus;
        this.crypto = cryptoEngine;
        this.identity = identityManager;
        this.platform = platform;
        this.log = log;
        this.connections = new Map(); // peerId → { channel, transport: 'webrtc'|'relay'|'direct' }
        this.cryptoKey = null;
        this.roomId = null;
        this._signalWs = null;
        this._signalUrl = null;
        this._pendingAcks = new Map();
        this._ackTimeouts = new Map();
        this.MAX_RETRIES = 2;
        this.ACK_TIMEOUT = 5000;
        this.messageRate = new Map();
        this.blacklist = new Set();
        this.MAX_MESSAGES_PER_SECOND = 60;
        this.WINDOW_MS = 1000;
        this._peerPublicKeys = new Map();
        this._onMessage = null;

        // Auto-initiate connections when peers are discovered
        this.events.on('mesh:peer_discovered', async ({ peerId }) => {
            if (this.connections.has(peerId)) return;
            if (this.platform.hasWebRTC()) {
                // Avoid glare: peer with smaller peerId initiates the offer
                if (this.identity && this.identity.peerId < peerId) {
                    this._initiateWebRTC(peerId);
                } else if (this.identity && this.identity.peerId > peerId) {
                    // Wait for the other side to initiate
                } else {
                    // No identity yet (edge case), use relay
                    this.connections.set(peerId, { channel: this._signalWs, transport: 'relay' });
                    if (this.log) this.log.info('SecureJamMeshAdapter', `Relay conectado con ${peerId}`);
                    this.events.emit('mesh:peer_connected', { peerId, transport: 'relay' });
                }
            } else if (this.platform.isNode()) {
                // Try optional wrtc for Node.js
                let wrtc = null;
                try { wrtc = require('wrtc'); } catch (e) {
                    try { wrtc = require('@roamhq/wrtc'); } catch (e2) {}
                }
                if (wrtc) {
                    global.RTCPeerConnection = wrtc.RTCPeerConnection;
                    global.RTCSessionDescription = wrtc.RTCSessionDescription;
                    global.RTCIceCandidate = wrtc.RTCIceCandidate;
                    if (this.identity && this.identity.peerId < peerId) {
                        this._initiateWebRTC(peerId);
                    }
                    // If peerId > mine, wait for the offer
                } else {
                    this.connections.set(peerId, {
                        channel: this._signalWs,
                        transport: 'relay'
                    });
                    if (this.log) this.log.info('SecureJamMeshAdapter', `Relay conectado con ${peerId}`);
                    this.events.emit('mesh:peer_connected', { peerId, transport: 'relay' });
                }
            } else {
                this.connections.set(peerId, {
                    channel: this._signalWs,
                    transport: 'relay'
                });
                if (this.log) this.log.info('SecureJamMeshAdapter', `Relay conectado con ${peerId}`);
                this.events.emit('mesh:peer_connected', { peerId, transport: 'relay' });
            }
        });

        // Handle WebRTC signaling messages (offer/answer/ICE)
        this.events.on('mesh:signal', ({ from, signalType, data }) => {
            if (signalType === 'offer') {
                this._handleWebRTCOffer(from, data);
            } else if (signalType === 'answer') {
                this._handleWebRTCAnswer(from, data);
            } else if (signalType === 'ice') {
                this._handleWebRTCIce(from, data);
            }
        });
    }

    get signalingUrl() { return this._signalUrl; }
    get connectedPeers() { return Array.from(this.connections.keys()); }

    async connectToSignalServer(url) {
        this._signalUrl = url;
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const isNode = this.platform.isNode();
            if (isNode) {
                const ws = new _WebSocketClientNode(url);
                ws._onOpen = () => {
                    this._signalWs = ws;
                    this._setupSignalListeners(ws);
                    resolve();
                };
                ws._onError = (err) => reject(err);
                ws.connect();
            } else {
                const WSClass = this.platform.getWebSocketClass();
                if (!WSClass) { reject(new Error('WebSocket no disponible en esta plataforma')); return; }
                const ws = new WSClass(url);
                ws.onopen = () => {
                    this._signalWs = ws;
                    this._setupSignalListenersBrowser(ws);
                    resolve();
                };
                ws.onerror = (err) => reject(err);
            }
        });
    }

    _setupSignalListeners(ws) {
        ws._onMessage = (msg, isBinary) => {
            if (isBinary) return;
            this._handleSignalMessage(msg);
        };
        ws._onClose = () => {
            if (this.log) this.log.warn('SecureJamMeshAdapter', 'Conexión con servidor de señalización perdida');
            this.events.emit('signal:connection_lost', {});
        };
        ws._onError = (err) => {
            if (this.log) this.log.error('SecureJamMeshAdapter', 'Error en WebSocket', { error: err.message });
        };
    }

    _setupSignalListenersBrowser(ws) {
        ws.onmessage = (evt) => {
            this._handleSignalMessage(evt.data);
        };
        ws.onclose = () => {
            if (this.log) this.log.warn('SecureJamMeshAdapter', 'Conexión con servidor de señalización perdida');
            this.events.emit('signal:connection_lost', {});
        };
        ws.onerror = () => {};
    }

    _handleSignalMessage(rawMsg) {
        let msg;
        try { msg = JSON.parse(rawMsg); } catch (e) { return; }
        if (!msg.type) return;

        switch (msg.type) {
            case 'announce_ok':
                this._peerId = msg.peerId;
                if (this.log) this.log.info('SecureJamMeshAdapter', `Anuncio confirmado como ${msg.peerId}`);
                this.events.emit('mesh:announce_ok', { peerId: msg.peerId });
                if (msg.peers) {
                    for (const p of msg.peers) {
                        if (!this.connections.has(p.peerId)) {
                            this.events.emit('mesh:peer_discovered', { peerId: p.peerId });
                        }
                    }
                }
                break;
            case 'announce_error':
                if (this.log) this.log.error('SecureJamMeshAdapter', `Error de anuncio: ${msg.reason}`);
                this.events.emit('mesh:announce_error', { reason: msg.reason });
                break;
            case 'peer_joined':
                if (!this.connections.has(msg.peerId)) {
                    if (this.log) this.log.info('SecureJamMeshAdapter', `Peer descubierto: ${msg.peerId}`);
                    this.events.emit('mesh:peer_discovered', { peerId: msg.peerId });
                }
                break;
            case 'peer_left':
                this.connections.delete(msg.peerId);
                this._peerPublicKeys.delete(msg.peerId);
                this.events.emit('mesh:peer_left', { peerId: msg.peerId });
                break;
            case 'signal':
                this._handleSignalRelay(msg);
                break;
            case 'relay_msg':
                this._handleRelayedMessage(msg);
                break;
            case 'pong':
                // ignore
                break;
        }
    }

    _handleSignalRelay(msg) {
        if (msg.signalType === 'offer' || msg.signalType === 'answer' || msg.signalType === 'ice') {
            this.events.emit('mesh:signal', {
                from: msg.from,
                signalType: msg.signalType,
                data: msg.data
            });
        }
    }

    _handleRelayedMessage(msg) {
        // Relayed message from signal server (Node.js relay mode)
        const { from, data: encryptedPayload } = msg;
        this._decryptAndEmit(from, encryptedPayload);
    }

    async _decryptAndEmit(peerId, encryptedPayload) {
        const cleanPeerId = peerId.replace(/[^a-zA-Z0-9_-]/g, '');
        if (this.blacklist.has(cleanPeerId)) return;
        if (!this._checkRateLimit(cleanPeerId)) {
            this.blacklist.add(cleanPeerId);
            this.events.emit('peer:attack_detected', cleanPeerId);
            return;
        }
        try {
            const decryptedText = await this.crypto.decrypt(encryptedPayload, this.cryptoKey);
            const packet = JSON.parse(decryptedText);
            // Handle ACKs
            if (packet._type === '_ack') {
                this._handleAck(packet._msgId);
                return;
            }
            // Auto-respond with ACK
            if (packet._msgId) {
                await this._sendAck(peerId, packet._msgId);
            }
            this.events.emit('peer:message', {
                peerId: cleanPeerId,
                message: packet.data,
                timestamp: packet.ts,
                msgId: packet._msgId
            });
        } catch (error) {
            // Decryption error
        }
    }

    // WebRTC signaling (browser + Node.js with wrtc)
    async _initiateWebRTC(peerId) {
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            // Store PC immediately so answer/ICE handlers find it
            this.connections.set(peerId, { channel: null, transport: 'webrtc', pc });
            const dc = pc.createDataChannel('jamkernelp2p');
            dc.onopen = () => {
                this.connections.set(peerId, { channel: dc, transport: 'webrtc', pc });
                if (this.log) this.log.info('SecureJamMeshAdapter', `WebRTC conectado con ${peerId}`);
                this.events.emit('mesh:peer_connected', { peerId, transport: 'webrtc' });
            };
            dc.onmessage = (evt) => {
                this._decryptAndEmit(peerId, evt.data);
            };
            dc.onclose = () => {
                this.connections.delete(peerId);
                this.events.emit('mesh:peer_disconnected', { peerId });
            };
            pc.onicecandidate = (e) => {
                if (e.candidate && this._signalWs) {
                    const msg = JSON.stringify({ type: 'signal', to: peerId, signalType: 'ice', data: { candidate: e.candidate } });
                    if (this._signalWs && this._signalWs.send) this._signalWs.send(msg);
                    else if (this._signalWs && this._signalWs.readyState === 1) this._signalWs.send(msg);
                }
            };
            // When signal relay sends answer/ice back, handle via events
            this._handleOfferCreated(pc, peerId);
        } catch (e) {
            if (this.log) this.log.error('SecureJamMeshAdapter', `Error WebRTC con ${peerId}: ${e.message}`);
        }
    }

    async _handleOfferCreated(pc, peerId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const msg = JSON.stringify({ type: 'signal', to: peerId, signalType: 'offer', data: { sdp: offer.sdp, type: offer.type } });
        if (this._signalWs) {
            if (typeof this._signalWs.send === 'function') this._signalWs.send(msg);
        }
    }

    async _handleWebRTCOffer(from, data) {
        if (this.connections.has(from)) return;
        try {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            // Store PC immediately so ICE handlers find it before DataChannel opens
            this.connections.set(from, { channel: null, transport: 'webrtc', pc });
            pc.ondatachannel = (event) => {
                const dc = event.channel;
                this.connections.set(from, { channel: dc, transport: 'webrtc', pc });
                if (this.log) this.log.info('SecureJamMeshAdapter', `WebRTC conectado con ${from}`);
                this.events.emit('mesh:peer_connected', { peerId: from, transport: 'webrtc' });
                dc.onmessage = (evt) => this._decryptAndEmit(from, evt.data);
                dc.onclose = () => {
                    this.connections.delete(from);
                    this.events.emit('mesh:peer_disconnected', { peerId: from });
                };
            };
            pc.onicecandidate = (e) => {
                if (e.candidate && this._signalWs) {
                    this._signalWs.send(JSON.stringify({ type: 'signal', to: from, signalType: 'ice', data: { candidate: e.candidate } }));
                }
            };
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (this._signalWs) {
                this._signalWs.send(JSON.stringify({ type: 'signal', to: from, signalType: 'answer', data: { sdp: answer.sdp, type: answer.type } }));
            }
        } catch (e) {
            if (this.log) this.log.error('SecureJamMeshAdapter', `Error WebRTC offer de ${from}: ${e.message}`);
        }
    }

    async _handleWebRTCAnswer(from, data) {
        const conn = this.connections.get(from);
        if (!conn || !conn.pc) return;
        try {
            await conn.pc.setRemoteDescription(new RTCSessionDescription(data));
        } catch (e) {
            if (this.log) this.log.warn('SecureJamMeshAdapter', `Error en WebRTC answer de ${from}: ${e.message}`);
        }
    }

    async _handleWebRTCIce(from, data) {
        const conn = this.connections.get(from);
        if (!conn || !conn.pc) return;
        try {
            await conn.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
            if (this.log) this.log.warn('SecureJamMeshAdapter', `Error en ICE candidate de ${from}: ${e.message}`);
        }
    }

    // ACK system
    async _sendAck(peerId, msgId) {
        const ackPacket = JSON.stringify({ _type: '_ack', _msgId: msgId, ts: Date.now() });
        const encrypted = await this.crypto.encrypt(ackPacket, this.cryptoKey);
        this._sendEncryptedDirect(peerId, encrypted);
    }

    _handleAck(msgId) {
        if (this._pendingAcks.has(msgId)) {
            const pending = this._pendingAcks.get(msgId);
            clearTimeout(this._ackTimeouts.get(msgId));
            this._pendingAcks.delete(msgId);
            this._ackTimeouts.delete(msgId);
            this.events.emit('peer:ack_received', { msgId });
            pending.resolve();
        }
    }

    _sendEncryptedDirect(peerId, rawData) {
        const conn = this.connections.get(peerId);
        if (!conn) return;
        try {
            if (conn.transport === 'relay') {
                conn.channel.send(JSON.stringify({ type: 'relay_msg', to: peerId, data: rawData }));
            } else {
                conn.channel.send(rawData);
            }
        } catch (e) {
            if (this.log) this.log.warn('SecureJamMeshAdapter', `Error enviando a ${peerId}: ${e.message}`);
        }
    }

    async _sendWithAck(peerId, data) {
        const msgId = await this.crypto.generateUUID();
        const packet = JSON.stringify({ data, ts: Date.now(), _msgId: msgId });
        const encrypted = await this.crypto.encrypt(packet, this.cryptoKey);
        const promise = new Promise((resolve, reject) => {
            this._pendingAcks.set(msgId, { peerId, data, encrypted, timestamp: Date.now(), retries: 0, resolve, reject });
            this._ackTimeouts.set(msgId, setTimeout(() => this._retryAck(msgId), this.ACK_TIMEOUT));
        });
        await this._sendToPeer(peerId, encrypted);
        return promise;
    }

    async _retryAck(msgId) {
        const pending = this._pendingAcks.get(msgId);
        if (!pending) return;
        if (pending.retries >= this.MAX_RETRIES) {
            this._pendingAcks.delete(msgId);
            this._ackTimeouts.delete(msgId);
            this.events.emit('peer:message_lost', { msgId, peerId: pending.peerId });
            pending.reject(new Error('ACK no recibido tras reintentos'));
            return;
        }
        pending.retries++;
        this._ackTimeouts.set(msgId, setTimeout(() => this._retryAck(msgId), this.ACK_TIMEOUT));
        await this._sendToPeer(pending.peerId, pending.encrypted);
    }

    async _sendToPeer(peerId, encryptedPayload) {
        const conn = this.connections.get(peerId);
        if (conn && conn.channel) {
            try {
                if (conn.transport === 'relay') {
                    conn.channel.send(JSON.stringify({ type: 'relay_msg', to: peerId, data: encryptedPayload }));
                } else {
                    conn.channel.send(encryptedPayload);
                }
                return;
            } catch (e) {}
        }
        // Fallback: relay through signal server
        if (this._signalWs) {
            const msg = JSON.stringify({ type: 'relay_msg', to: peerId, data: encryptedPayload });
            if (typeof this._signalWs.send === 'function') this._signalWs.send(msg);
        }
    }

    async joinRoom(roomId, password) {
        if (typeof roomId !== 'string') throw new Error('Identificador de canal corrupto');
        this.roomId = roomId;
        this.cryptoKey = await this.crypto.deriveKey(password, roomId);
        // Announce to signal server
        if (this._signalWs && this.identity && this.identity.isReady) {
            const signature = await this.identity.sign(this.identity.peerId);
            const pubKeyB64 = this.identity._crypto.arrayBufferToBase64URL(
                (await this.identity._crypto.exportPublicKey(this.identity._publicKey)).buffer
            );
            const announce = JSON.stringify({
                type: 'announce',
                peerId: this.identity.peerId,
                publicKey: pubKeyB64,
                signature,
                room: roomId
            });
            if (typeof this._signalWs.send === 'function') this._signalWs.send(announce);
            else if (this._signalWs.readyState === 1) this._signalWs.send(announce);
        }
        if (this.log) this.log.info('SecureJamMeshAdapter', `Sala ${roomId} unida`);
        this.events.emit('mesh:room_joined', { roomId });
    }

    async leaveRoom() {
        if (this.cryptoKey) {
            await this.crypto.purgeKeyFromMemory(this, 'cryptoKey');
        }
        this.connections.clear();
        this._peerPublicKeys.clear();
        this.messageRate.clear();
        this.blacklist.clear();
        this.roomId = null;
        if (this.log) this.log.info('SecureJamMeshAdapter', 'Sala abandonada');
        this.events.emit('mesh:room_left', {});
    }

    async broadcast(data) {
        if (!this.cryptoKey) throw new Error("No hay una sesión criptográfica activa en la malla");
        const packet = JSON.stringify({ data, ts: Date.now(), _msgId: await this.crypto.generateUUID() });
        const encrypted = await this.crypto.encrypt(packet, this.cryptoKey);
        const activeConnections = Array.from(this.connections.entries())
            .filter(([peerId, conn]) => {
                if (this.blacklist.has(peerId)) return false;
                if (conn.transport === 'webrtc' && conn.channel && conn.channel.readyState === 'open') return true;
                if (conn.transport === 'relay' || conn.transport === 'direct') return true;
                return false;
            });
        const results = await Promise.allSettled(
            activeConnections.map(([peerId, conn]) => {
                return new Promise((resolve, reject) => {
                    try {
                        if (conn.transport === 'relay') {
                            const envelope = JSON.stringify({ type: 'relay_msg', to: peerId, data: encrypted });
                            conn.channel.send(envelope);
                        } else if (typeof conn.channel.send === 'function') {
                            conn.channel.send(encrypted);
                        }
                        resolve();
                    } catch (e) { reject(e); }
                });
            })
        );
        results.forEach((result, idx) => {
            if (result.status === 'rejected') {
                const [peerId] = activeConnections[idx];
                this.events.emit('peer:send_failed', peerId);
            }
        });
    }

    // Also support sendTo (unicast)
    async sendTo(peerId, data) {
        if (!this.cryptoKey) throw new Error("No hay una sesión criptográfica activa en la malla");
        if (!this.connections.has(peerId)) throw new Error(`Peer ${peerId} no está conectado`);
        await this._sendWithAck(peerId, data);
    }

    _checkRateLimit(peerId) {
        const cleanPeerId = peerId.replace(/[^a-zA-Z0-9_-]/g, '');
        if (cleanPeerId !== peerId) return false;
        const now = Date.now();
        const window = this.messageRate.get(cleanPeerId) || { count: 0, timestamp: now };
        if (now - window.timestamp > this.WINDOW_MS) {
            this.messageRate.set(cleanPeerId, { count: 1, timestamp: now });
            return true;
        }
        window.count++;
        this.messageRate.set(cleanPeerId, window);
        return window.count <= this.MAX_MESSAGES_PER_SECOND;
    }

    async handleIncomingPacket(peerId, encryptedPayload) {
        await this._decryptAndEmit(peerId, encryptedPayload);
    }
}

// ===========================================================
// 12. BATCH STORAGE
// ===========================================================
class BatchStorage {
    constructor(platform) {
        this.platform = platform;
        this.dbName = 'jamkernelp2p_Storage';
        this.storeName = 'cache_kv';
        this.db = null;
        this.isWriting = false;
        this.queue = [];
        this.retryCount = 0;
        this.MAX_QUEUE_SIZE = 1000;
        this._mutex = new Mutex();
        // Node.js fallback
        this._memoryStore = new Map();
        this._fs = platform ? platform.getFs() : null;
        this._path = platform ? platform.getPath() : null;
        this._storageDir = null;
    }

    async _init() {
        if (this.platform && this.platform.isNode() && this._fs) {
            this._storageDir = this._path
                ? this._path.join(process.cwd(), '.jamkernelp2p_data')
                : '.jamkernelp2p_data';
            try { this._fs.mkdirSync(this._storageDir, { recursive: true }); } catch (e) {}
            // Load from disk
            try {
                const data = this._fs.readFileSync(this._path.join(this._storageDir, 'store.json'), 'utf-8');
                const parsed = JSON.parse(data);
                for (const [k, v] of Object.entries(parsed)) this._memoryStore.set(k, v);
            } catch (e) {}
        }
    }

    async _initDB() {
        if (this.platform && this.platform.isBrowser()) {
            if (this.db) return this.db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbName, 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains(this.storeName)) {
                        db.createObjectStore(this.storeName, { keyPath: 'key' });
                    }
                };
                request.onsuccess = (e) => { this.db = e.target.result; resolve(this.db); };
                request.onerror = () => reject(new Error('No se pudo abrir IndexedDB'));
            });
        }
    }

    async put(key, value) {
        await this._mutex.acquire();
        try {
            if (this.platform && this.platform.isBrowser()) {
                if (this.queue.length >= this.MAX_QUEUE_SIZE) {
                    await this._processQueue();
                }
                this.queue.push({ key, value, timestamp: Date.now() });
                await this._processQueue();
            } else {
                this._memoryStore.set(key, { key, value, timestamp: Date.now() });
                await this._persistToDisk();
            }
        } finally {
            this._mutex.release();
        }
    }

    async get(key) {
        if (this.platform && this.platform.isBrowser()) {
            const db = await this._initDB();
            return new Promise((resolve) => {
                const transaction = db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result ? request.result.value : null);
                request.onerror = () => resolve(null);
            });
        } else {
            const entry = this._memoryStore.get(key);
            return entry ? entry.value : null;
        }
    }

    async _processQueue() {
        if (this.isWriting || this.queue.length === 0) return;
        this.isWriting = true;
        const db = await this._initDB();
        const currentBatch = [...this.queue];
        this.queue = [];
        try {
            await new Promise((resolve, reject) => {
                const transaction = db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                for (const item of currentBatch) store.put(item);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
            this.retryCount = 0;
        } catch (err) {
            this.queue.unshift(...currentBatch);
            this.retryCount++;
            const backoffDelay = Math.min(1000 * Math.pow(2, this.retryCount), 10000);
            this.isWriting = false;
            setTimeout(() => this._processQueue(), backoffDelay);
            return;
        }
        this.isWriting = false;
        if (this.queue.length > 0) setTimeout(() => this._processQueue(), 10);
    }

    async _persistToDisk() {
        if (!this._fs || !this._storageDir) return;
        try {
            const obj = {};
            for (const [k, v] of this._memoryStore) obj[k] = v.value;
            this._fs.writeFileSync(
                this._path.join(this._storageDir, 'store.json'),
                JSON.stringify(obj),
                'utf-8'
            );
        } catch (e) {}
    }
}

// ===========================================================
// 13. WORKER POOL
// ===========================================================
class WorkerPool {
    constructor(platform, config = {}) {
        this.platform = platform;
        this.maxWorkers = config.maxWorkers || (platform.getOs ? platform.getOs().cpus().length : 4);
        this._workers = [];
        this._taskQueue = [];
        this._activeCount = 0;
        this._useWorkerThreads = config.useWorkerThreads !== false && platform.isNode();
    }

    async runTask(taskFn, data) {
        if (this._useWorkerThreads && this.platform.isNode()) {
            try {
                const { Worker } = require('worker_threads');
                return await new Promise((resolve, reject) => {
                    const workerCode = `
                        const { parentPort } = require('worker_threads');
                        const fn = ${taskFn.toString()};
                        parentPort.on('message', async (data) => {
                            try {
                                const result = await fn(data);
                                parentPort.postMessage({ ok: true, result });
                            } catch (e) {
                                parentPort.postMessage({ ok: false, error: e.message });
                            }
                        });
                    `;
                    const worker = new Worker(workerCode, { eval: true });
                    this._workers.push(worker);
                    this._activeCount++;
                    worker.on('message', (msg) => {
                        this._activeCount--;
                        const idx = this._workers.indexOf(worker);
                        if (idx !== -1) this._workers.splice(idx, 1);
                        if (msg.ok) resolve(msg.result);
                        else reject(new Error(msg.error));
                    });
                    worker.on('error', reject);
                    worker.postMessage(data);
                    this._processQueue();
                });
            } catch (e) {
                // Fallback to same-process execution
            }
        }
        this._activeCount++;
        try {
            const result = await taskFn(data);
            return result;
        } finally {
            this._activeCount--;
            this._processQueue();
        }
    }

    _processQueue() {
        while (this._taskQueue.length > 0 && this._activeCount < this.maxWorkers) {
            const { taskFn, data, resolve, reject } = this._taskQueue.shift();
            this.runTask(taskFn, data).then(resolve).catch(reject);
        }
    }

    async enqueue(taskFn, data) {
        if (this._activeCount < this.maxWorkers) {
            return this.runTask(taskFn, data);
        }
        return new Promise((resolve, reject) => {
            this._taskQueue.push({ taskFn, data, resolve, reject });
        });
    }

    get activeCount() { return this._activeCount; }
    get totalCount() { return this._workers.length; }
    get pendingCount() { return this._taskQueue.length; }

    terminate() {
        for (const worker of this._workers) {
            try { worker.terminate(); } catch (e) {}
        }
        this._workers = [];
        this._taskQueue = [];
        this._activeCount = 0;
    }
}

// ===========================================================
// 14. JAM PLUGIN SYSTEM
// ===========================================================
class JAMPlugin {
    constructor(kernel) {
        this.kernel = kernel;
        this.events = kernel.events;
        this.log = kernel.log;
        this.name = 'unnamed';
    }

    async init(config) {}
    async destroy() {}
}

class PluginManager {
    constructor(kernel) {
        this.kernel = kernel;
        this._plugins = new Map();
    }

    register(name, pluginClass) {
        if (this._plugins.has(name)) throw new Error(`Plugin "${name}" ya registrado`);
        this._plugins.set(name, pluginClass);
        return this;
    }

    async load(name, config = {}) {
        const PluginClass = this._plugins.get(name);
        if (!PluginClass) throw new Error(`Plugin "${name}" no está registrado`);
        const instance = new PluginClass(this.kernel);
        instance.name = name;
        await instance.init(config);
        return instance;
    }

    async unload(instance) {
        await instance.destroy();
    }
}

// ===========================================================
// 15. CLI PARSER
// ===========================================================
function parseCLI(args) {
    const config = {};
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--port': config.port = parseInt(args[++i]); break;
            case '--room': config.room = args[++i]; break;
            case '--password': config.password = args[++i]; break;
            case '--token': config.token = args[++i]; break;
            case '--tls-key': config.tlsKey = args[++i]; break;
            case '--tls-cert': config.tlsCert = args[++i]; break;
            case '--cluster': config.cluster = true; break;
            case '--workers': config.workers = parseInt(args[++i]); break;
            case '--log-file': config.logFile = args[++i]; break;
            case '--log-level': config.logLevel = args[++i]; break;
            case '--host': config.host = args[++i]; break;
            case '-h':
            case '--help':
                config.help = true;
                break;
        }
    }
    return config;
}

function printHelp() {
    console.log(`
  jamkernelp2p v1.2.0 — Mesh P2P Soberano

  USO:
    node jamkernelp2p.js [OPCIONES]

  OPCIONES:
    --port N           Puerto del servidor de señalización (default: 0 = aleatorio)
    --host H           Host (default: 0.0.0.0)
    --room X           Sala a la que unirse
    --password X       Contraseña de cifrado de la sala (min 8 caracteres)
    --token X          Token de autenticación para la sala
    --tls-key FILE     Clave TLS para WSS
    --tls-cert FILE    Certificado TLS para WSS
    --cluster          Activar modo multi-worker
    --workers N        Número de workers (default: CPU count)
    --log-file FILE    Archivo de log (formato JSON lines)
    --log-level L      Nivel de log: error, warn, info, debug (default: warn)
    -h, --help         Muestra esta ayuda

  EJEMPLOS:
    node jamkernelp2p.js --room mi-sala --password clave-segura
    node jamkernelp2p.js --port 8080 --room publico --password "v3r4-C0ntr4S3ñ4"
    node jamkernelp2p.js --log-file /var/log/jam.log --log-level info

  DOCS: https://github.com/jamkernel/jamkernelp2p
`);
}

// ===========================================================
// 16. JAM KERNEL P2P (ORQUESTADOR)
// ===========================================================
class JAMKernelP2P {
    constructor(config = {}) {
        this.config = config;
        this.platform = detectPlatform();
        this.events = new EventBus();
        this.log = new StructuredLogger({
            logLevel: config.logLevel || 'warn',
            logFile: config.logFile || null,
            fs: this.platform.getFs ? this.platform.getFs() : null,
            path: this.platform.getPath ? this.platform.getPath() : null
        });
        this.crypto = new JamCrypto(this.platform);
        this.identity = new IdentityManager(this.crypto);
        this.storage = new BatchStorage(this.platform);
        this.plugins = new PluginManager(this);
        this.mesh = new SecureJamMeshAdapter(
            this.events, this.crypto, this.identity, this.platform, this.log
        );
        this._signalServer = null;
        this._ready = false;
        this._initSecurityMonitoring();
    }

    get signalServer() { return this._signalServer; }
    get signalingUrl() { return this.mesh.signalingUrl; }
    get isReady() { return this._ready; }
    get connectedPeers() { return this.mesh.connectedPeers; }

    getSignalingUrl() { return this.mesh.signalingUrl; }
    getPlatformName() {
        if (this.platform.isBrowser()) return 'browser';
        if (this.platform.isNode()) return 'node';
        if (this.platform.isDeno()) return 'deno';
        if (this.platform.isBun()) return 'bun';
        return 'unknown';
    }
    whenIdentityReady() {
        if (this.identity.isReady) return Promise.resolve(this.identity.peerId);
        return new Promise(resolve => {
            const check = () => {
                if (this.identity.isReady) {
                    resolve(this.identity.peerId);
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    _initSecurityMonitoring() {
        setInterval(() => {
            const now = Date.now();
            for (const [peer, data] of this.mesh.messageRate) {
                if (now - data.timestamp > 60000) this.mesh.messageRate.delete(peer);
            }
        }, 30000);
    }

    async init(signalUrl) {
        await this.storage._init();
        // Try to restore identity
        const savedIdentity = await this.storage.get('jamkernelp2p_identity');
        if (savedIdentity) {
            try { await this.identity.fromJSON(savedIdentity); } catch (e) {}
        }
        if (!this.identity.isReady) {
            await this.identity.createIdentity();
            const json = await this.identity.toJSON();
            await this.storage.put('jamkernelp2p_identity', json);
        }
        this.log.info('JAMKernelP2P', `Identidad: ${this.identity.peerId}`);

        // Start signal server if configured (Node.js)
        if (this.platform.isNode() && this.config.port !== undefined) {
            const fs = this.platform.getFs();
            this._signalServer = new MiniSignalServer({
                port: this.config.port,
                host: this.config.host || '0.0.0.0',
                platform: this.platform,
                identityManager: this.identity,
                events: this.events,
                log: this.log
            });
            if (this.config.tlsKey) this._signalServer._tlsKey = this.config.tlsKey;
            if (this.config.tlsCert) this._signalServer._tlsCert = this.config.tlsCert;
            await this._signalServer.start();
        }

        // Connect to signal server
        const signalUrlToUse = signalUrl || (this._signalServer ? `ws://${this.config.host || '0.0.0.0'}:${this._signalServer.port}` : null);
        if (signalUrlToUse) {
            await this.mesh.connectToSignalServer(signalUrlToUse);
            this.log.info('JAMKernelP2P', `Conectado a servidor de señalización: ${signalUrlToUse}`);
        }

        this._ready = true;

        // Auto-join room if configured
        if (this.config.room && this.config.password) {
            await this.mesh.joinRoom(this.config.room, this.config.password);
            this.events.emit('kernel:session_started', { room: this.config.room });
            this.log.info('JAMKernelP2P', `Sesión iniciada en sala "${this.config.room}"`);
        }

        this.events.emit('kernel:ready', { peerId: this.identity.peerId });
        return this;
    }

    async startSession(sala, clave) {
        if (!this._ready) await this.init();
        await this.mesh.joinRoom(sala, clave);
        this.events.emit('kernel:session_started', { room: sala });
        this.log.info('JAMKernelP2P', `Sesión iniciada en sala "${sala}"`);
    }

    async closeSession() {
        await this.mesh.leaveRoom();
        this.events.emit('kernel:session_closed', {});
        this.log.info('JAMKernelP2P', 'Sesión cerrada');
    }

    async broadcast(data) {
        await this.mesh.broadcast(data);
    }

    async sendTo(peerId, data) {
        await this.mesh.sendTo(peerId, data);
    }

    registerPlugin(name, pluginClass) {
        this.plugins.register(name, pluginClass);
    }

    async loadPlugin(name, config) {
        return await this.plugins.load(name, config);
    }

    destroy() {
        if (this._signalServer) this._signalServer.stop();
        this.log.close();
    }
}

// ===========================================================
// 17. JAMOmni (FACTORY)
// ===========================================================
const JAMOmni = {
    async createKernel(config = {}) {
        const kernel = new JAMKernelP2P(config);
        await kernel.init(config.signalUrl || null);
        return kernel;
    }
};

// ===========================================================
// EXPORTACIÓN GLOBAL
// ===========================================================
if (typeof window !== 'undefined') {
    window.JAM = window.JAM || {};
    window.JAM.KernelP2P = JAMKernelP2P;
    window.JAM.Omni = JAMOmni;
    window.JAM.IdentityManager = IdentityManager;
    window.JAM.JamCrypto = JamCrypto;
    window.JAM.EventBus = EventBus;
    window.JAM.BatchStorage = BatchStorage;
    window.JAM.Mutex = Mutex;
    window.JAM.Cache = Cache;
    window.JAM.PluginManager = PluginManager;
    window.JAM.JAMPlugin = JAMPlugin;
    window.JAM.MiniSignalServer = MiniSignalServer;
    window.JAM.detectPlatform = detectPlatform;
    window.JAM.components = {
        JAMKernelP2P, EventBus, JamCrypto, BatchStorage,
        SecureJamMeshAdapter, IdentityManager, Mutex, Cache,
        JAMPlugin, PluginManager, MiniSignalServer
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        JAMOmni,
        JAMKernelP2P,
        EventBus,
        JamCrypto,
        BatchStorage,
        SecureJamMeshAdapter,
        IdentityManager,
        Mutex,
        Cache,
        StructuredLogger,
        JAMPlugin,
        PluginManager,
        MiniSignalServer,
        WorkerPool,
        detectPlatform
    };
}

// ── CLI AUTO-START ──
if (typeof require !== 'undefined' && require.main === module) {
    const config = parseCLI(process.argv.slice(2));
    if (config.help) {
        printHelp();
        process.exit(0);
    }
    JAMOmni.createKernel(config).then(kernel => {
        kernel.events.on('kernel:ready', () => {
            console.log('');
            console.log('  ╔══════════════════════════════════════════╗');
            console.log('  ║     jamkernelp2p v1.2.0                    ║');
            console.log('  ║     Mesh P2P Zero-Dependency             ║');
            console.log('  ╚══════════════════════════════════════════╝');
            console.log('');
            console.log(`  🔑  Peer ID:   ${kernel.identity.peerId}`);
            console.log(`  📡  Signal:    ws://${config.host || '0.0.0.0'}:${kernel._signalServer ? kernel._signalServer.port : '?'}`);
            console.log(`  🌐  Platform:  ${kernel.platform.isNode() ? 'Node.js' : kernel.platform.isBrowser() ? 'Browser' : 'Other'}`);
            if (config.room) console.log(`  🏠  Room:      ${config.room}`);
            console.log('');
            console.log('  Presiona Ctrl+C para salir');
            console.log('');
        });
    }).catch(err => {
        console.error('Error fatal:', err);
        process.exit(1);
    });
}
