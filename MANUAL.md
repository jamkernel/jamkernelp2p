# Manual de uso — jamkernelp2p v1.2.0

Guía completa para desplegar y usar jamkernelp2p en cualquier entorno: Browser, Node.js, Deno y Bun.

---

## Índice

1. [Instalación y despliegue](#1-instalación-y-despliegue)
   - [En navegador (script tag)](#en-navegador-script-tag)
   - [En navegador (ESM)](#en-navegador-esm)
   - [En Node.js (CommonJS)](#en-nodejs-commonjs)
   - [En Node.js (ESM)](#en-nodejs-esm)
   - [En Deno](#en-deno)
   - [En Bun](#en-bun)
2. [API completa](#2-api-completa)
   - [JAMOmni.createKernel()](#jamomnicreatekernel)
   - [JAMOmniKernel](#jamomnikernel)
   - [IdentityManager](#identitymanager)
   - [SecureJamMeshAdapter](#securejammeshadapter)
   - [EventBus](#eventbus)
   - [BatchStorage](#batchstorage)
   - [Cache](#cache)
   - [JamCrypto](#jamcrypto)
   - [WorkerPool](#workerpool)
   - [Mutex](#mutex)
3. [CLI — Línea de comandos](#3-cli--línea-de-comandos)
   - [Opciones completas](#opciones-completas)
   - [Ejemplos de uso directo](#ejemplos-de-uso-directo)
   - [Cluster mode](#cluster-mode)
   - [Logging estructurado](#logging-estructurado)
   - [Modo TLS (WSS)](#modo-tls-wss)
4. [Nuevas características v1.2.0](#4-nuevas-características-v210)
   - [Autenticación ECDSA + Token](#autenticación-ecdsa--token)
   - [Rate limiting anti-DoS](#rate-limiting-anti-dos)
   - [ACKs de entrega de mensajes](#acks-de-entrega-de-mensajes)
   - [Persistencia de estado mesh](#persistencia-de-estado-mesh)
   - [Purga forense de claves](#purga-forense-de-claves)
5. [Ejemplos de uso](#5-ejemplos-de-uso)
   - [Chat P2P básico](#chat-p2p-básico)
   - [Transferencia de archivos](#transferencia-de-archivos)
   - [Aplicación colaborativa](#aplicación-colaborativa)
   - [Bridge Node.js-Browser](#bridge-nodejs-browser)
6. [Despliegue profesional](#6-despliegue-profesional)
   - [Modo Node.js como relay permanente](#modo-nodejs-como-relay-permanente)
   - [Modo browser-only (sin Node.js)](#modo-browser-only-sin-nodejs)
   - [Alta disponibilidad](#alta-disponibilidad)
   - [Seguridad](#seguridad)
7. [Solución de problemas](#7-solución-de-problemas)
   - [El peer no conecta al servidor de señalización](#el-peer-no-conecta-al-servidor-de-señalización)
   - [Firma inválida / bad_signature](#firma-inválida--bad_signature)
   - [Rate limiting / attack_detected](#rate-limiting--attack_detected)
   - [Mesh se desconecta al recargar el navegador](#mesh-se-desconecta-al-recargar-el-navegador)
   - [Cluster: workers no se comunican](#cluster-workers-no-se-comunican)
   - [Logs no se escriben al archivo](#logs-no-se-escriben-al-archivo)
   - [TLS: certificado no aceptado](#tls-certificado-no-aceptado)
   - [Error de derivación de clave / password corto](#error-de-derivación-de-clave--password-corto)
   - [Mesh no descubre peers](#mesh-no-descubre-peers)
   - [Peer Node.js no sirve HTTP](#peer-nodejs-no-sirve-http)

---

## 1. Instalación y despliegue

### En navegador (script tag)

```html
<script src="/ruta/jamkernelp2p.js"></script>
<script>
    const { JAMOmni, IdentityManager } = window.JAM;
    // jamkernelp2p está disponible globalmente
</script>
```

Todas las clases quedan en `window.JAM`:
- `JAM.Omni` — alias de `JAMOmni`
- `JAM.IdentityManager`
- `JAM.MiniSignalServer`
- `JAM.SecureJamMeshAdapter`
- `JAM.BatchStorage`
- `JAM.JamCrypto`
- `JAM.EventBus`
- `JAM.WorkerPool`
- `JAM.Cache`
- `JAM.Mutex`
- `JAM.BrowserAdapter`
- `JAM.detectPlatform`
- `JAM.components` — objeto con todas las clases

### En navegador (ESM)

```html
<script type="module">
    import { JAMOmni, IdentityManager } from './jamkernelp2p.js';
    // Uso normal con imports
</script>
```

### En Node.js (CommonJS)

```js
const { JAMOmni } = require('./jamkernelp2p.js');
const kernel = await JAMOmni.createKernel({});
```

### En Node.js (ESM)

```js
import { JAMOmni } from './jamkernelp2p.js';
const kernel = await JAMOmni.createKernel({});
```

### En Deno

```ts
import { JAMOmni } from './jamkernelp2p.js';
// Deno es detectado automáticamente
const kernel = await JAMOmni.createKernel({});
```

### En Bun

```ts
import { JAMOmni } from './jamkernelp2p.js';
const kernel = await JAMOmni.createKernel({});
```

Bun es detectado como Node.js (tiene `process.versions.node`), y funciona sin problemas.

---

## 2. API completa

### JAMOmni.createKernel()

Punto de entrada principal. Crea y configura un kernel completo automáticamente.

```js
const kernel = await JAMOmni.createKernel(config);
```

**Config:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `signalServer` | `string` | `'wss://signal.jam.net'` | URL del servidor de señalización. En Node.js, si no se especifica, arranca uno embebido |
| `autoSignalingPort` | `number` | `0` | Puerto para el servidor de señalización embebido (0 = puerto aleatorio) |
| `iceServers` | `RTCIceServer[]` | Google STUN | Servidores ICE para WebRTC |
| `maxWorkers` | `number` | `4` | Máximo de workers en el pool |
| `workerTTL` | `number` | `60000` | TTL de workers inactivos (ms) |
| `cacheTTL` | `number` | `60000` | TTL por defecto de caché (ms) |
| `cacheMaxSize` | `number` | `1000` | Máximo de items en caché |
| `debug` | `boolean` | `false` | Modo debug (logs detallados) |
| `logLevel` | `string` | `'warn'` | Nivel de log: `error`, `warn`, `info`, `debug` |
| `name` | `string` | `'jamkernelp2p'` | Nombre de la instancia |
| `version` | `string` | `'1.2.0'` | Versión de la aplicación |

### JAMOmniKernel

Instancia devuelta por `createKernel()`.

**Propiedades:**

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `kernel.peerId` | `string` | UUID del peer (se reemplaza por el derivado de identidad cuando está lista) |
| `kernel.platform` | `IPlatform` | Adaptador de plataforma activo |
| `kernel.events` | `EventBus` | Bus de eventos del sistema |
| `kernel.crypto` | `JamCrypto` | Motor criptográfico |
| `kernel.mesh` | `SecureJamMeshAdapter` | Adaptador mesh (cifrado, anti-DoS) |
| `kernel.identity` | `IdentityManager` | Gestor de identidad ECDSA |
| `kernel.workerPool` | `WorkerPool` | Pool de workers sandbox |
| `kernel.cache` | `Cache` | Sistema de caché |
| `kernel.isRunning` | `boolean` | Si hay una sesión activa |
| `kernel.isInitialized` | `boolean` | Si la plataforma está inicializada |
| `kernel.isDestroyed` | `boolean` | Si el kernel fue destruido |

**Métodos:**

| Método | Descripción |
|--------|-------------|
| `await kernel.whenIdentityReady()` | Espera a que la identidad ECDSA esté generada/restaurada |
| `await kernel.startSession(roomId, password)` | Se une a una sala mesh |
| `await kernel.closeSession()` | Cierra la sesión y purga claves |
| `await kernel.broadcast(data)` | Transmite datos cifrados a todos los peers |
| `kernel.registerPlugin(name, pluginClass)` | Registra un plugin |
| `await kernel.loadPlugin(name, config)` | Carga e inicializa un plugin |
| `await kernel.unloadPlugin(name)` | Descarga un plugin |
| `kernel.getPlugin(name)` | Obtiene instancia de un plugin |
| `kernel.getPlugins()` | Lista plugins registrados |
| `kernel.getStatus()` | Estado completo del kernel |
| `await kernel.destroy()` | Destruye el kernel y libera recursos |

**Eventos del kernel:**

```js
kernel.events.on('kernel:initialized', ({ platform, peerId }) => {});
kernel.events.on('kernel:ready', ({ status, peerId, roomId, platform }) => {});
kernel.events.on('kernel:closed', ({ status }) => {});
kernel.events.on('kernel:destroyed', () => {});

// Eventos de peer
kernel.events.on('peer:connected', ({ peerId }) => {});
kernel.events.on('peer:disconnected', ({ peerId }) => {});
kernel.events.on('peer:message', ({ peerId, senderId, message, timestamp }) => {});
kernel.events.on('peer:attack_detected', (peerId) => {});
kernel.events.on('peer:bad_signature', ({ peerId }) => {});
kernel.events.on('peer:identity_verified', ({ peerId }) => {});
kernel.events.on('peer:decrypt_error', ({ peerId, error }) => {});
kernel.events.on('peer:send_failed', ({ peerId, error }) => {});

// Eventos de mesh
kernel.events.on('mesh:joined', ({ roomId }) => {});
kernel.events.on('mesh:left', ({ roomId }) => {});
kernel.events.on('mesh:peer_discovered', ({ peerId }) => {});
kernel.events.on('mesh:peer_disconnected', ({ peerId }) => {});
kernel.events.on('mesh:no_peers', () => {});
kernel.events.on('mesh:error', ({ error }) => {});

// Eventos de señalización
kernel.events.on('signal:peer_joined', ({ peerId }) => {});
kernel.events.on('signal:peer_left', ({ peerId }) => {});
kernel.events.on('signal:peer_list', ({ peers }) => {});
kernel.events.on('signal:server_started', ({ url, port }) => {});
kernel.events.on('signal:connected', ({ url }) => {});
kernel.events.on('signal:disconnected', ({ url }) => {});
kernel.events.on('signal:connection_error', ({ url, error }) => {});
kernel.events.on('signal:reconnecting', ({ attempt, maxAttempts, delay }) => {});
kernel.events.on('signal:connection_failed', ({ maxAttempts }) => {});

// Eventos de plugin
kernel.events.on('plugin:loaded', ({ name, config }) => {});
kernel.events.on('plugin:unloaded', ({ name }) => {});
```

### IdentityManager

Gestiona la identidad ECDSA P-256 del peer.

```js
const identity = new IdentityManager(platform);

// Generar nueva identidad
await identity.generate();

// Importar identidad existente
await identity.importIdentity(publicKeyBytes, privateKeyBytes);

// Propiedades
identity.peerId;        // UUID derivado de SHA-256(publicKey)
identity.publicKey;     // Uint8Array(65) clave pública raw
identity.isInitialized; // boolean

// Firmar y verificar
const signature = await identity.sign(data);       // data: string | object
const isValid = await identity.verify(data, signature, publicKey);

// Exportar para persistencia
const json = identity.toJSON();
// { peerId, publicKey: number[], privateKey: number[] }
```

**Nota:** En `JAMOmni.createKernel()`, la identidad se genera automáticamente y se persiste en BatchStorage. Usa `await kernel.whenIdentityReady()` para asegurarte de que está lista.

### SecureJamMeshAdapter

Maneja el mesh cifrado con control anti-DoS y verificación de firmas.

```js
const mesh = kernel.mesh;

// Unirse / salir de sala
await mesh.joinRoom(roomId, password);   // password ≥ 8 caracteres
await mesh.leaveRoom();
mesh.isJoined();  // boolean

// Transmitir a todos los peers conectados
await mesh.broadcast(data);   // data: cualquier valor serializable

// Gestionar conexiones directas
mesh.addConnection(peerId, channel);    // Añade un canal WebRTC/WebSocket
mesh.onPeerDiscovered(peerId);          // Notifica peer descubierto vía gossip
mesh.onPeerLeft(peerId);                // Notifica peer desconectado
mesh.getPeers();                        // Array de peerIds conectados
mesh.getPeerCount();                    // Número de peers conectados
mesh.getVerifiedPeers();                // Peers con clave pública conocida

// Gestionar claves públicas de peers
mesh.storePeerPublicKey(peerId, publicKey);
mesh.getPeerPublicKey(peerId);
mesh.hasPeerPublicKey(peerId);

// Procesar paquete entrante (para integración manual)
await mesh.handleIncomingPacket(peerId, encryptedPayload);
```

### EventBus

Sistema de eventos desacoplado.

```js
const bus = new EventBus();

// Escuchar evento
const unsubscribe = bus.on('evento', (data) => {
    console.log('Recibido:', data);
});

// Emitir evento
bus.emit('evento', { mensaje: 'hola' });

// Escuchar una sola vez
bus.once('evento', (data) => {});

// Dejar de escuchar
unsubscribe();

// Limpiar todos los eventos
bus.clear();
```

### BatchStorage

Sistema de almacenamiento con respaldo IndexedDB (browser) o memoria compartida (Node.js). Es la "base de datos" del ecosistema jamkernelp2p.

```js
const storage = new BatchStorage(platform, options);

// Guardar
await storage.put('mi-clave', { cualquier: 'valor', numeros: 42 });

// Leer
const valor = await storage.get('mi-clave');

// Eliminar
await storage.delete('mi-clave');

// Limpiar todo
await storage.clear();

// Estadísticas
storage.getStats();
// { queueSize, isWriting, usingMemory, itemCount }
```

**Opciones:**

| Opción | Default | Descripción |
|--------|---------|-------------|
| `maxQueueSize` | `1000` | Máximo de operaciones en cola |
| `batchSize` | `50` | Tamaño de lote para escritura |
| `maxMemoryItems` | `1000` | Máximo de items en memoria |

**Características:**
- En browser: usa IndexedDB con respaldo a memoria si falla
- En Node.js: usa memoria compartida entre todas las instancias del mismo proceso
- Escritura por lotes con backoff exponencial
- Mutex interno antibloqueo

### Cache

Caché en memoria con TTL y límite de tamaño.

```js
const cache = new Cache({ ttl: 60000, maxSize: 1000 });

cache.set('clave', { datos: 'importantes' });

const valor = cache.get('clave');
// → { datos: 'importantes' } o null si expiró

cache.delete('clave');
cache.clear();

cache.getStats();
// { size, maxSize, hits, misses, evictions }
```

### JamCrypto

Motor criptográfico nativo vía WebCrypto.

```js
const crypto = new JamCrypto(platform);

// Derivar clave a partir de contraseña + sala (PBKDF2)
const key = await crypto.deriveKey(password, roomId);

// Cifrar/descifrar
const encrypted = await crypto.encrypt(textoPlano, key);
const decrypted = await crypto.decrypt(encrypted, key);

// Generar clave aleatoria
const randomKey = await crypto.generateKey();

// Purga forense de claves de memoria
await crypto.purgeKeyFromMemory(objeto, 'nombrePropiedad');
```

### WorkerPool

Pool de workers para ejecución en sandbox. Aísla plugins no confiables.

```js
const pool = new WorkerPool({ maxWorkers: 4, workerTTL: 60000 });

// Ejecutar código en worker sandbox
const resultado = await pool.exec((datos) => {
    // Código que se ejecuta en el worker
    // No tiene acceso a require, fetch, ni al contexto global
    return datos.input * 2;
}, { input: 21 });

console.log(resultado); // 42

// Estadísticas
pool.getStats();
// { activeWorkers, idleWorkers, totalTasks, failedTasks }
```

**Limitaciones del sandbox:**
- No tiene acceso a `require()`, `import`, `fetch`
- `Function.prototype.constructor` anulado (bloquea `new Function()`)
- `Object.prototype` y `__proto__` protegidos
- Solo puede usar lógica pura con los datos que recibe como argumento

### Mutex

Mutex asíncrono con timeout y anti-bloqueo.

```js
const mutex = new Mutex();

await mutex.lock('recurso-clave');
try {
    // Operación exclusiva
} finally {
    mutex.unlock('recurso-clave');
}

// Con timeout (lanza error si no obtiene el lock en 5s)
await mutex.lock('recurso', 5000);
```

---

## 3. Ejemplos de uso

### Chat P2P básico

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function chat() {
    const kernel = await JAMOmni.createKernel({});
    const identity = await kernel.whenIdentityReady();

    console.log(`Tu peerId: ${identity.peerId}`);

    // Escuchar mensajes entrantes
    kernel.events.on('peer:message', ({ senderId, message }) => {
        console.log(`${senderId}: ${message.text}`);
    });

    // Escuchar peers que se conectan/desconectan
    kernel.events.on('peer:connected', ({ peerId }) => {
        console.log(`👤 ${peerId} se conectó`);
    });
    kernel.events.on('peer:disconnected', ({ peerId }) => {
        console.log(`👋 ${peerId} se desconectó`);
    });

    // Unirse a sala
    await kernel.startSession('chat-publico', 'clave-compartida');

    // Enviar mensajes
    process.stdin.on('data', async (data) => {
        const text = data.toString().trim();
        await kernel.broadcast({ text, type: 'chat' });
    });

    // Mantener vivo
    process.on('SIGINT', async () => {
        await kernel.destroy();
        process.exit();
    });
}

chat();
```

### Transferencia de archivos

Usando BatchStorage como buffer y el mesh para transmitir:

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function fileTransfer() {
    const kernel = await JAMOmni.createKernel({});
    await kernel.whenIdentityReady();
    await kernel.startSession('file-share', 'clave-files');

    const CHUNK_SIZE = 64000; // 64KB

    // Enviar archivo
    async function sendFile(filename, data) {
        const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await kernel.broadcast({
                type: 'file_chunk',
                filename,
                chunk: i,
                total: totalChunks,
                data: Array.from(chunk),
                size: data.length
            });
        }
    }

    // Recibir archivo (usando storage como buffer)
    const fileBuffers = new Map();

    kernel.events.on('peer:message', async ({ senderId, message }) => {
        if (message.type === 'file_chunk') {
            if (!fileBuffers.has(message.filename)) {
                fileBuffers.set(message.filename, {
                    chunks: [],
                    total: message.total,
                    size: message.size
                });
            }
            const file = fileBuffers.get(message.filename);
            file.chunks[message.chunk] = new Uint8Array(message.data);

            // Último chunk: reconstruir y guardar
            if (message.chunk === message.total - 1) {
                const complete = new Uint8Array(message.size);
                let offset = 0;
                for (const c of file.chunks) {
                    complete.set(c, offset);
                    offset += c.length;
                }
                // Guardar en storage
                await kernel._storage.put(`file_${message.filename}`, Array.from(complete));
                console.log(`✅ Archivo recibido: ${message.filename}`);
                kernel.events.emit('file:complete', { filename: message.filename, data: complete });
            }
        }
    });

    // Ejemplo: enviar un archivo pequeño
    const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    await sendFile('saludo.txt', testData);
}
```

### Aplicación colaborativa

Pizarra compartida usando el mesh para sincronizar estado:

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function collaborativeApp() {
    const kernel = await JAMOmni.createKernel({});
    await kernel.whenIdentityReady();
    await kernel.startSession('colab', 'clave-colab');

    // Estado compartido (CRDT simple)
    const state = { shapes: [], cursors: {} };

    // Escuchar actualizaciones
    kernel.events.on('peer:message', ({ senderId, message }) => {
        if (message.type === 'shape_added') {
            state.shapes.push(message.shape);
            render(); // función de renderizado
        }
        if (message.type === 'cursor_move') {
            state.cursors[senderId] = message.position;
            renderCursors();
        }
    });

    // Enviar acciones
    function addShape(shape) {
        state.shapes.push(shape);
        kernel.broadcast({ type: 'shape_added', shape });
    }

    function moveCursor(x, y) {
        kernel.broadcast({ type: 'cursor_move', position: { x, y } });
    }
}
```

### Bridge Node.js-Browser

El caso de uso más potente: Node.js como relay + API REST, browsers como clientes mesh.

**Node.js (`server.js`):**

```js
const { JAMOmni } = require('./jamkernelp2p.js');
const http = require('http');
const fs = require('fs');

async function main() {
    const kernel = await JAMOmni.createKernel({});
    const id = await kernel.whenIdentityReady();

    // Historial de mensajes en storage
    await kernel.startSession('app', 'clave-app');

    kernel.events.on('peer:message', async ({ senderId, message }) => {
        // Persistir mensajes
        const history = (await kernel._storage.get('chat_history')) || [];
        history.push({ senderId, message, ts: Date.now() });
        await kernel._storage.put('chat_history', history.slice(-1000));
    });

    // API REST para consultar historial
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.url === '/api/history') {
            kernel._storage.get('chat_history').then(history => {
                res.end(JSON.stringify(history || []));
            });
        } else if (req.url === '/api/status') {
            res.end(JSON.stringify(kernel.getStatus()));
        } else {
            res.end(JSON.stringify({ error: 'not found' }));
        }
    });

    const port = process.env.API_PORT || 8080;
    server.listen(port, () => {
        console.log(`API en http://localhost:${port}`);
        console.log(`PeerId: ${id.peerId}`);
    });
}

main();
```

**Browser:**

```html
<script src="/jamkernelp2p.js"></script>
<script>
(async () => {
    const kernel = await JAM.Omni.createKernel({
        signalServer: 'ws://localhost:puerto-signal'
    });
    const identity = await kernel.whenIdentityReady();
    await kernel.startSession('app', 'clave-app');

    // Chat
    document.getElementById('send').onclick = async () => {
        const text = document.getElementById('msg').value;
        await kernel.broadcast({ text, type: 'chat' });
    };

    kernel.events.on('peer:message', ({ message }) => {
        const div = document.createElement('div');
        div.textContent = message.text;
        document.getElementById('messages').appendChild(div);
    });
})();
</script>
```

---

## 3. CLI — Línea de comandos

El kernel puede ejecutarse directamente como proceso independiente. No necesitas escribir código — solo ejecutas el archivo con flags.

```bash
node jamkernelp2p.js [opciones]
```

### Opciones completas

| Flag | Default | Descripción |
|------|---------|-------------|
| `--port N` | `0` (aleatorio) | Puerto del servidor de señalización |
| `--token X` | — | Token de autenticación para el servidor (protege contra accesos no autorizados) |
| `--room X` | — | Sala a la que unirse automáticamente al iniciar |
| `--password X` | — | Contraseña de cifrado AES-256-GCM de la sala (mínimo 8 caracteres) |
| `--tls-key FILE` | — | Ruta a la clave privada TLS para WSS (WebSocket seguro) |
| `--tls-cert FILE` | — | Ruta al certificado TLS para WSS |
| `--cluster` | — | Activa modo multi-worker (distribuye peers entre procesos) |
| `--workers N` | CPU count | Número de workers en cluster |
| `--log-file FILE` | — | Archivo de log estructurado en formato JSON lines |
| `--log-level L` | `warn` | Nivel de logging: `error`, `warn`, `info`, `debug` |
| `--help`, `-h` | — | Muestra la ayuda completa y sale |

### Ejemplos de uso directo

```bash
# Mínimo: arranca con puerto aleatorio
node jamkernelp2p.js

# Producción básica
node jamkernelp2p.js --port 8080 --room chat-publico --password "k3y-s3cr3t4!"

# Con token de autenticación (solo peers que conocen el token pueden unirse)
node jamkernelp2p.js --port 443 --room privado --password clave \
  --token "eyJhbGciOiJIUzI1NiJ9"

# Todo activado: TLS + cluster + logging
node jamkernelp2p.js \
  --port 443 \
  --tls-key /etc/letsencrypt/live/midominio.com/privkey.pem \
  --tls-cert /etc/letsencrypt/live/midominio.com/fullchain.pem \
  --room produccion \
  --password "c0ntr4s3ñ4-muy-fu3rt3-2026" \
  --token "$jamkernelp2p_AUTH_TOKEN" \
  --cluster --workers 4 \
  --log-file /var/log/jam/mesh.log \
  --log-level info
```

### Cluster mode

El modo cluster distribuye los peers entre múltiples procesos worker usando el módulo `cluster` nativo de Node.js.

**Cómo funciona:**
- El proceso primario (primary) acepta todas las conexiones WebSocket y las distribuye entre los workers vía IPC
- Cada worker maneja un subconjunto de peers
- El primario reenvía mensajes mesh entre workers cuando `target` pertenece a otro worker
- Si un worker muere, el primario notifica `peer_left` a los demás workers

```bash
# Usar número de workers = CPUs disponibles
node jamkernelp2p.js --cluster --room test --password clave

# Especificar número de workers
node jamkernelp2p.js --cluster --workers 4 --room test --password clave
```

**Limitaciones:**
- El primario NO maneja conexiones de peers — solo distribuye
- Para >1000 peers concurrentes, considera usar un message broker externo (NATS, Redis)
- La memoria compartida (`BatchStorage`) no se sincroniza entre workers automáticamente

### Logging estructurado

El `StructuredLogger` escribe logs en formato JSON lines, ideal para ingestion en sistemas como Elasticsearch, Loki o Datadog.

```bash
# Activar logging a archivo
node jamkernelp2p.js --log-file /var/log/jam/mesh.log --log-level debug
```

Cada línea del log tiene este formato:
```json
{"ts":"2026-06-23T10:30:00.123Z","level":"info","msg":"Signal server started on port 8080","cid":"abc123..."}
```

**Características:**
- Rotación automática a 10MB (el archivo se renombra a `.1.log`)
- Timestamp ISO 8601 con milisegundos
- Niveles: `error` (0), `warn` (1), `info` (2), `debug` (3)
- Si no se especifica `--log-file`, los logs se muestran en consola con formato legible

### Modo TLS (WSS)

Para producción con tráfico cifrado entre peers y servidor de señalización:

```bash
# Generar certificado autofirmado (desarrollo):
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes

# Arrancar con TLS:
node jamkernelp2p.js --tls-key key.pem --tls-cert cert.pem --port 443
```

El servidor automáticamente usa HTTPS en lugar de HTTP, y WSS en lugar de WS. La URL se muestra como `wss://hostname:port`.

---

## 4. Características v1.2.0

> Respecto a v1.0 (kernel original), v1.2.0 agrega: **ECDH forward secrecy**, **ratchet de claves**, **LAN discovery**, **heartbeat**, **anti-replay**, **PBKDF2(600K)** y **19 bugs corregidos**. Ver README para tabla comparativa detallada.

### Autenticación ECDSA + Token

Cada peer tiene una identidad ECDSA P-256. Al conectarse al servidor de señalización:

1. El peer envía `{ type: 'announce', peerId, publicKey, signature, token? }`
2. El servidor verifica que `peerId === SHA-256(publicKey)` (prueba de identidad)
3. El servidor verifica la `signature` sobre el announce (prueba de posesión de clave privada)
4. Si hay `--token`, el servidor verifica que coincida

```js
// Desde la API, el token se pasa en la configuración del kernel:
const kernel = await JAMOmni.createKernel({
    signalServer: 'ws://localhost:8080',
    signalToken: 'mi-token-secreto'  // se envía en cada announce
});
```

### Rate limiting anti-DoS

Protección contra abusos en el servidor de señalización:

| Límite | Valor | Consecuencia |
|--------|-------|-------------|
| Mensajes/segundo por conexión | 60 | Desconexión automática |
| Tamaño máximo de mensaje | 256 KB | Desconexión + log |
| Tiempo máximo inactivo | 5 minutos | Desconexión por idle |
| Blacklist por rate limit | 60 segundos | No acepta nuevas conexiones |

```js
// Configurar límites vía API (antes de startSession):
kernel.mesh.MAX_MESSAGES_PER_SECOND = 30;    // default: 60
kernel.mesh.BLACKLIST_DURATION_MS = 120000;  // default: 60000 (1 min)
```

### ECDH + Ratchet (Forward Secrecy)

Cuando dos peers se conectan, intercambian claves efímeras ECDH P-256. La clave compartida se usa como semilla para un **ratchet** que avanza con cada mensaje:

```
Peer A                          Peer B
  │  ECDH public key ─────────►   │
  │  ◄───────── ECDH public key   │
  │                               │
  │  shared = ECDH(privA, pubB)   │
  │  key0 = SHA-256(shared + room)│
  │                               │
  │  msg1 cifrado con key0 ────►  │
  │                         key1 = SHA-256(key0 + ':jam-ratchet')
  │  ◄─── msg2 cifrado con key1  │
  │                         key2 = SHA-256(key1 + ':jam-ratchet')
```

Beneficios:
- **Forward secrecy**: si una clave de sesión se compromete, los mensajes anteriores siguen seguros
- **Anti-replay**: cada clave se usa una sola vez; reenviar un mensaje interceptado falla al descifrar
- Activated automáticamente al conectar con un peer. No requiere configuración.

```js
// Verificar si una conexión usa ratchet:
const conn = kernel.mesh.connections.get(peerId);
console.log('Ratchet activo:', !!conn?.ratchetKey);
```

### Anti-replay (ventana deslizante)

Cada peer mantiene una ventana deslizante de 64 números de secuencia. Si un mensaje ya fue recibido o está fuera de la ventana, se descarta automáticamente:

```js
kernel.events.on('peer:attack_detected', (peerId) => {
    console.warn(`Posible replay attack desde ${peerId}`);
});
```

El umbral de detección se configura en:
```js
kernel.mesh.REPLAY_WINDOW_SIZE = 64;  // default
```

### LAN Discovery

En Node.js, el kernel descubre peers automáticamente en la red local vía UDP broadcast, sin dependencias externas:

```bash
# Se activa automáticamente al iniciar (solo Node.js)
node jamkernelp2p.js --room local --password clave
```

El peer envía un beacon UDP cada 10s con su `peerId` y `signalUrl`. Al recibir un beacon, intenta conectar automáticamente.

**Puerto UDP usado:** 42020 (configurable vía `kernel.mesh._discPort`).

### Heartbeat (keepalive)

El kernel envía un `ping` al servidor de señalización cada 30s para mantener la conexión activa:

```js
// Configurar intervalo (antes de init):
kernel.mesh._heartbeatIntervalMs = 30000;  // default: 30s
```

Si el servidor no responde, el kernel emite:
```js
kernel.events.on('signal:connection_lost', () => {
    console.warn('Conexión con signal server perdida');
});
```

El heartbeat solo envía `ping` (no datos cifrados vacíos como en v1.0), evitando falsos positivos de rate limiting.

### ACKs de entrega de mensajes

Cada mensaje mesh incluye un `_msgId` único. El receptor responde automáticamente con un ACK.

```js
// Evento cuando se recibe un ACK:
kernel.events.on('mesh:ack', ({ msgId, peerId }) => {
    console.log(`Mensaje ${msgId} entregado a ${peerId}`);
});

// Evento si un ACK no llega (timeout de 10s):
kernel.events.on('mesh:ack_timeout', ({ msgId, peerId }) => {
    console.warn(`Mensaje ${msgId} no entregado a ${peerId}`);
});
```

### Persistencia de estado mesh

El kernel guarda automáticamente el estado del mesh (sala activa, peers conocidos) en `BatchStorage`. Al reiniciar, restaura el estado.

**Datos persistidos:**
- `roomId` de la sala activa
- Plataforma detectada
- (Futuro) lista de pares conocidos

**Control manual:**
```js
// Forzar guardado de estado
await kernel._saveMeshState({ roomId: 'mi-sala', platform: 'node' });

// Cargar estado guardado
const state = await kernel._loadMeshState();

// Limpiar estado
await kernel._clearMeshState();
```

### Purga forense de claves

Al llamar `closeSession()`, el kernel sobrescribe y elimina las claves criptográficas de la memoria RAM:

```js
await kernel.closeSession();
// Todas las claves AES, PBKDF2 y ECDSA son purgadas de la memoria
```

Esto previene ataques de cold boot o volcado de memoria en entornos compartidos. Ideal para:
- Quioscos públicos
- Entornos cloud multi-tenant
- Sesiones temporales

---

## 5. Ejemplos de uso

### Chat P2P básico

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function chat() {
    const kernel = await JAMOmni.createKernel({});
    const identity = await kernel.whenIdentityReady();

    console.log(`Tu peerId: ${identity.peerId}`);

    // Escuchar mensajes entrantes
    kernel.events.on('peer:message', ({ senderId, message }) => {
        console.log(`${senderId}: ${message.text}`);
    });

    // Escuchar peers que se conectan/desconectan
    kernel.events.on('peer:connected', ({ peerId }) => {
        console.log(`👤 ${peerId} se conectó`);
    });
    kernel.events.on('peer:disconnected', ({ peerId }) => {
        console.log(`👋 ${peerId} se desconectó`);
    });

    // Unirse a sala
    await kernel.startSession('chat-publico', 'clave-compartida');

    // Enviar mensajes
    process.stdin.on('data', async (data) => {
        const text = data.toString().trim();
        await kernel.broadcast({ text, type: 'chat' });
    });

    // Mantener vivo
    process.on('SIGINT', async () => {
        await kernel.destroy();
        process.exit();
    });
}

chat();
```

### Transferencia de archivos

Usando BatchStorage como buffer y el mesh para transmitir:

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function fileTransfer() {
    const kernel = await JAMOmni.createKernel({});
    await kernel.whenIdentityReady();
    await kernel.startSession('file-share', 'clave-files');

    const CHUNK_SIZE = 64000; // 64KB

    // Enviar archivo
    async function sendFile(filename, data) {
        const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
            const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            await kernel.broadcast({
                type: 'file_chunk',
                filename,
                chunk: i,
                total: totalChunks,
                data: Array.from(chunk),
                size: data.length
            });
        }
    }

    // Recibir archivo (usando storage como buffer)
    const fileBuffers = new Map();

    kernel.events.on('peer:message', async ({ senderId, message }) => {
        if (message.type === 'file_chunk') {
            if (!fileBuffers.has(message.filename)) {
                fileBuffers.set(message.filename, {
                    chunks: [],
                    total: message.total,
                    size: message.size
                });
            }
            const file = fileBuffers.get(message.filename);
            file.chunks[message.chunk] = new Uint8Array(message.data);

            // Último chunk: reconstruir y guardar
            if (message.chunk === message.total - 1) {
                const complete = new Uint8Array(message.size);
                let offset = 0;
                for (const c of file.chunks) {
                    complete.set(c, offset);
                    offset += c.length;
                }
                // Guardar en storage
                await kernel._storage.put(`file_${message.filename}`, Array.from(complete));
                console.log(`✅ Archivo recibido: ${message.filename}`);
                kernel.events.emit('file:complete', { filename: message.filename, data: complete });
            }
        }
    });

    // Ejemplo: enviar un archivo pequeño
    const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    await sendFile('saludo.txt', testData);
}
```

### Aplicación colaborativa

Pizarra compartida usando el mesh para sincronizar estado:

```js
const { JAMOmni } = require('./jamkernelp2p.js');

async function collaborativeApp() {
    const kernel = await JAMOmni.createKernel({});
    await kernel.whenIdentityReady();
    await kernel.startSession('colab', 'clave-colab');

    // Estado compartido (CRDT simple)
    const state = { shapes: [], cursors: {} };

    // Escuchar actualizaciones
    kernel.events.on('peer:message', ({ senderId, message }) => {
        if (message.type === 'shape_added') {
            state.shapes.push(message.shape);
            render(); // función de renderizado
        }
        if (message.type === 'cursor_move') {
            state.cursors[senderId] = message.position;
            renderCursors();
        }
    });

    // Enviar acciones
    function addShape(shape) {
        state.shapes.push(shape);
        kernel.broadcast({ type: 'shape_added', shape });
    }

    function moveCursor(x, y) {
        kernel.broadcast({ type: 'cursor_move', position: { x, y } });
    }
}
```

### Bridge Node.js-Browser

El caso de uso más potente: Node.js como relay + API REST, browsers como clientes mesh.

**Node.js (`server.js`):**

```js
const { JAMOmni } = require('./jamkernelp2p.js');
const http = require('http');
const fs = require('fs');

async function main() {
    const kernel = await JAMOmni.createKernel({});
    const id = await kernel.whenIdentityReady();

    // Historial de mensajes en storage
    await kernel.startSession('app', 'clave-app');

    kernel.events.on('peer:message', async ({ senderId, message }) => {
        // Persistir mensajes
        const history = (await kernel._storage.get('chat_history')) || [];
        history.push({ senderId, message, ts: Date.now() });
        await kernel._storage.put('chat_history', history.slice(-1000));
    });

    // API REST para consultar historial
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.url === '/api/history') {
            kernel._storage.get('chat_history').then(history => {
                res.end(JSON.stringify(history || []));
            });
        } else if (req.url === '/api/status') {
            res.end(JSON.stringify(kernel.getStatus()));
        } else {
            res.end(JSON.stringify({ error: 'not found' }));
        }
    });

    const port = process.env.API_PORT || 8080;
    server.listen(port, () => {
        console.log(`API en http://localhost:${port}`);
        console.log(`PeerId: ${id.peerId}`);
    });
}

main();
```

**Browser:**

```html
<script src="/jamkernelp2p.js"></script>
<script>
(async () => {
    const kernel = await JAM.Omni.createKernel({
        signalServer: 'ws://localhost:puerto-signal'
    });
    const identity = await kernel.whenIdentityReady();
    await kernel.startSession('app', 'clave-app');

    // Chat
    document.getElementById('send').onclick = async () => {
        const text = document.getElementById('msg').value;
        await kernel.broadcast({ text, type: 'chat' });
    };

    kernel.events.on('peer:message', ({ message }) => {
        const div = document.createElement('div');
        div.textContent = message.text;
        document.getElementById('messages').appendChild(div);
    });
})();
</script>
```

---

## 6. Despliegue profesional

### Modo Node.js como relay permanente

Para tener un peer que sirva como relay 24/7:

```bash
# Uso directo con todo incluido
node jamkernelp2p.js \
  --port 8080 \
  --room produccion \
  --password "$jamkernelp2p_PASSWORD" \
  --token "$jamkernelp2p_TOKEN" \
  --log-file /var/log/jam/mesh.log \
  --log-level info

# O usando el demo script
node jam-peer.js

# Con PM2 para que viva siempre
npm install -g pm2
pm2 start jamkernelp2p.js --name jam-relay -- \
  --port 8080 --room produccion --password clave
pm2 save
pm2 startup
```

Para producción real, combina con systemd:

```ini
# /etc/systemd/system/jam.service
[Unit]
Description=jamkernelp2p Mesh Relay
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/jam/jamkernelp2p.js \
  --port 443 \
  --tls-key /etc/letsencrypt/live/midominio/privkey.pem \
  --tls-cert /etc/letsencrypt/live/midominio/fullchain.pem \
  --room produccion \
  --password "$jamkernelp2p_PASSWORD" \
  --log-file /var/log/jam/mesh.log \
  --log-level info
Restart=always
User=jam
EnvironmentFile=/etc/jam/env

[Install]
WantedBy=multi-user.target
```

### Modo browser-only (sin Node.js)

Si no tienes un servidor Node.js, necesitas un servidor de señalización externo. Puedes:
1. Usar un servicio público compatible con WebSocket
2. O desplegar MiniSignalServer en un entorno serverless (poco práctico)

Para browser-only, configura:

```js
const kernel = await JAMOmni.createKernel({
    signalServer: 'wss://tu-servidor-señalización.com'
});
```

### Alta disponibilidad

Para un despliegue robusto:

```js
const kernel = await JAMOmni.createKernel({
    maxReconnectAttempts: 20,
    signalServer: 'wss://backup1.signal.com',
    // El kernel reconecta automáticamente con backoff exponencial
});
```

En cluster, la alta disponibilidad se logra con múltiples instancias detrás de un load balancer:

```bash
# Servidor 1
node jamkernelp2p.js --port 8080 --room produccion --password clave

# Servidor 2 (otra máquina, misma sala y contraseña)
node jamkernelp2p.js --port 8081 --room produccion --password clave
```

Cada servidor es independiente. Los peers se conectan al que tengan configurado.

### Seguridad

```js
// 1. Usar contraseñas fuertes (≥12 caracteres)
await kernel.startSession('sala', 'v3r4-C0ntr4S3ñ4-Fu3rt3!');

// 2. Token de autenticación en el servidor
const kernel = await JAMOmni.createKernel({
    signalServer: 'ws://localhost:8080',
    signalToken: 'token-secreto-compartido'
});

// 3. TLS para tráfico cifrado
// Pasa --tls-key y --tls-cert al arrancar, o configúralo desde NodeAdapter

// 4. Verificar identidad de peers
kernel.events.on('peer:connected', async ({ peerId }) => {
    if (!kernel.mesh.hasPeerPublicKey(peerId)) {
        await kernel.broadcast({
            type: 'request_key',
            target: peerId,
            from: kernel.identity.peerId
        });
    }
});

// 5. Purga forense al cerrar
await kernel.closeSession(); // purga automática de claves en RAM

// 6. Rate limiting (anti-DoS)
kernel.mesh.MAX_MESSAGES_PER_SECOND = 30; // para redes confiables
```

### Stack de seguridad completo recomendado

| Capa | Mecanismo | Quién lo provee |
|------|-----------|-----------------|
| Transporte | TLS (WSS) | MiniSignalServer con `--tls-key`/`--tls-cert` |
| Autenticación | Token + Firma ECDSA | MiniSignalServer + IdentityManager |
| Cifrado extremo a extremo | AES-256-GCM + PBKDF2 | JamCrypto |
| Integridad | HMAC-SHA256 + Firmas ECDSA | SecureJamMeshAdapter |
| Anti-DoS | Rate limiting + Blacklist | MiniSignalServer |
| Anti-suplantación | peerId = SHA-256(publicKey) | IdentityManager |
| Purga forense | Sobrescritura de claves en RAM | JamCrypto.purgeKeyFromMemory() |

---

## 7. Solución de problemas

### El peer no conecta al servidor de señalización

**Síntoma:** Se ven estos eventos en consola:
```
signal:connection_error → signal:reconnecting → signal:connection_failed
```

**Causas posibles:**
1. Puerto incorrecto o cerrado
2. Firewall bloqueando la conexión
3. URL del servidor mal configurada
4. TLS mal configurado (certificado no coincide con hostname)
5. Otro proceso ocupando el puerto

**Diagnóstico:**
```bash
# Verificar puerto abierto
netstat -an | findstr :8080

# Probar conexión WebSocket desde PowerShell
$ws = New-Object System.Net.WebSockets.ClientWebSocket
$ws.ConnectAsync("ws://localhost:8080", [System.Threading.CancellationToken]::None).GetAwaiter().GetResult()

# Verificar que no haya otro proceso en el puerto
netstat -ano | findstr :8080
```

**Soluciones:**
- Abrir puerto en firewall: `netsh advfirewall firewall add rule name="jamkernelp2p" dir=in action=allow protocol=TCP localport=8080`
- Si usas WSS, el certificado debe coincidir con el hostname exacto
- Cambiar puerto con `--port` si el default está ocupado

### Firma inválida / bad_signature

**Síntoma:**
```
event: peer:bad_signature → { peerId }
```

**Causas posibles:**
1. El peer que envía no tiene su clave pública registrada en el receptor
2. Ataque de suplantación (alguien intenta hacerse pasar por otro peerId)
3. La identidad ECDSA se regeneró (clave privada distinta, mismo peerId imposible porque peerId = hash(pubKey))

**Diagnóstico:**
```js
kernel.events.on('peer:bad_signature', ({ peerId }) => {
    console.warn(`Firma inválida de ${peerId}`);
    console.warn(`Tiene clave pública?: ${kernel.mesh.hasPeerPublicKey(peerId)}`);
});
```

**Soluciones:**
- Tras `peer:connected`, intercambiar claves públicas automáticamente
- Limpiar claves cacheadas si hay falsos positivos: `mesh.clearVerifiedPeers()`
- El servidor ya rechaza announces con firma inválida en origen (check `peerId == SHA-256(pubKey)`)

### Rate limiting / attack_detected

**Síntoma:**
```
event: peer:attack_detected → peerId
```

**Causas posibles:**
1. Un peer envía más de 60 mensajes/segundo (por defecto)
2. Mensajes individuales de más de 256 KB
3. Bucle accidental en la aplicación

**Comportamiento del sistema:**
- El peer infractor entra en blacklist automática por 60 segundos
- Durante la blacklist, todas sus conexiones son rechazadas
- Se registra el incidente en el log

**Soluciones:**
- No requiere acción manual — el kernel se protege automáticamente
- Si es falso positivo (ej. transferencia de archivos grande):
  ```js
  kernel.mesh.MAX_MESSAGES_PER_SECOND = 120;
  ```
- Para desbloquear un peer en blacklist manualmente:
  ```js
  // Si hay acceso al método interno:
  kernel.mesh._rateLimit?.reset(peerId);
  ```

### Mesh se desconecta al recargar el navegador

**Síntoma:** Al recargar la página, el peer aparece con un peerId diferente.

**Causa:** La identidad ECDSA se pierde si IndexedDB es borrado o si el almacenamiento fue limpiado.

**Explicación:** La identidad se persiste automáticamente en BatchStorage:
- **Browser:** usa IndexedDB
- **Node.js:** usa memoria compartida del proceso
- Si el usuario borra datos del sitio (o usa modo incógnito), se genera nueva identidad

**Soluciones:**
- Para persistencia forzada entre recargas, exportar/importar manualmente:
  ```js
  // Antes de recargar:
  const json = identity.toJSON();
  localStorage.setItem('jam-identity', JSON.stringify(json));

  // Al cargar de nuevo (antes de createKernel):
  const saved = JSON.parse(localStorage.getItem('jam-identity'));
  // Pasar como config a createKernel
  const kernel = await JAMOmni.createKernel({
      identity: {
          publicKey: new Uint8Array(saved.publicKey),
          privateKey: new Uint8Array(saved.privateKey)
      }
  });
  ```
- Si es aceptable que cambie, simplemente esperar a que el estado del mesh se restaure solo

### Cluster: workers no se comunican

**Síntoma:** Peers en diferentes workers del cluster no se descubren entre sí.

**Causa:** El cluster usa IPC de Node.js para comunicación entre workers. El proceso primario actúa como relay.

**Arquitectura:**
```
Conexión WebSocket → Primary (acepta) → Worker 1 (IPC)
Conexión WebSocket → Primary (acepta) → Worker 2 (IPC)
Worker 1 → Primary (reenvía mesh) → Worker 2
```

**Soluciones:**
- Verificar que todos los workers usen el mismo `--token` si el servidor tiene autenticación
- El primario reenvía automáticamente eventos `peer_joined`, `peer_left` y mensajes mesh
- Si un worker muere, el primario notifica a los demás con `peer_left` para cada peer de ese worker
- Para clústeres grandes (>1000 peers), considera un message broker externo (NATS, Redis Pub/Sub)

### Logs no se escriben al archivo

**Síntoma:** `--log-file /ruta/archivo.log` no produce archivo.

**Causas posibles:**
1. El directorio padre no existe
2. Permisos de escritura insuficientes
3. Ruta incorrecta (especialmente en Windows con barras)

**Diagnóstico:**
```bash
# Verificar que el directorio existe
Test-Path -LiteralPath "C:\logs"

# Verificar permisos
icacls "C:\logs"
```

**Soluciones:**
- Crear el directorio antes de arrancar:
  ```bash
  mkdir -p /var/log/jam        # Linux
  New-Item -ItemType Directory -Path "C:\logs\jam"  # Windows
  ```
- Usar rutas absolutas en producción
- En Windows, escapar barras: `--log-file C:\\logs\\jam\\mesh.log`
- El archivo se crea automáticamente si no existe (pero el directorio SÍ debe existir)
- Rotación automática: al llegar a 10MB se renombra a `.1.log`

### TLS: certificado no aceptado

**Síntoma:** En el navegador: `ERR_CERT_AUTHORITY_INVALID` o `SEC_ERROR_UNKNOWN_ISSUER`.

**Causas posibles:**
1. Certificado autofirmado para desarrollo
2. Certificado expirado
3. Hostname no coincide con el CN/SAN del certificado

**Soluciones:**
- **Desarrollo:** Aceptar la excepción de seguridad manualmente en el navegador
- **Producción:** Usar Let's Encrypt (certbot) o un CA comercial
  ```bash
  # Let's Encrypt
  sudo certbot certonly --standalone -d midominio.com
  # Usar:
  # --tls-key /etc/letsencrypt/live/midominio.com/privkey.pem
  # --tls-cert /etc/letsencrypt/live/midominio.com/fullchain.pem
  ```
- Verificar que el certificado coincida con el hostname:
  ```bash
  openssl x509 -in cert.pem -text -noout | grep "Subject: CN"
  ```
- Para pruebas locales sin TLS, usar `ws://localhost:PUERTO` en lugar de WSS

### Error de derivación de clave / password corto

**Síntoma:** Al llamar `startSession()`:
```
Error: Password must be at least 8 characters long
```

**Causa:** `startSession()` exige passwords de mínimo 8 caracteres por seguridad.

**Explicación técnica:** La contraseña se usa como entrada de PBKDF2 con 60,000 iteraciones para derivar la clave AES-256-GCM. Un password corto es vulnerable a ataques de fuerza bruta incluso con PBKDF2.

**Soluciones:**
- Usar contraseñas de 12+ caracteres con mezcla de mayúsculas, minúsculas, números y símbolos
- Ejemplos de contraseñas válidas:
  ```
  "k3y-S3cr3t4-P4r4-J4M-2026"     ✓ (recomendada)
  "abcdefgh"                        ✓ (mínimo, solo pruebas)
  "12345678"                        ✓ (mínimo, solo pruebas locales)
  ```
- Para pruebas rápidas: `await kernel.startSession('test', '12345678')`

### Mesh no descubre peers

**Síntoma:** `mesh:peer_discovered` nunca se dispara. El contador de peers permanece en 0.

**Causas posibles:**
1. Los peers apuntan a diferentes servidores de señalización
2. NAT/firewall bloqueando WebRTC (browser)
3. El servidor de señalización no tiene otros peers conectados
4. Problema de gossip: el mensaje `peer_joined` no se propagó

**Diagnóstico:**
```js
// Verificar conexión al signal
kernel.events.on('signal:connected', ({ url }) => {
    console.log('Conectado al signal:', url);
});

// Verificar lista de peers al conectarse
kernel.events.on('signal:peer_list', ({ peers }) => {
    console.log('Peers en el servidor:', peers.length, peers);
});

// Estado actual del mesh
console.log(kernel.mesh.getPeers());
console.log(kernel.mesh.getPeerCount());
```

**Soluciones:**
- Verificar que TODOS los peers usen la misma URL de servidor de señalización
- El servidor envía `peer_list` al conectarse y `peer_joined` en tiempo real
- Para redes locales, usar IP directa: `signalServer: 'ws://192.168.1.100:8080'`
- Si hay NAT, configurar STUN/TURN (por defecto tiene Google STUN público)
- Para browser, asegurar que WebRTC no esté bloqueado (politicas corporativas, VPN)

### Peer Node.js no sirve HTTP

**Síntoma:** Al usar `node jamkernelp2p.js --port 8080`, no hay página web en `http://localhost:8080`.

**Causa:** El kernel CLI (`jamkernelp2p.js`) arranca **solo el servidor de señalización WebSocket**, sin servidor HTTP para archivos estáticos.

**Diferencia entre los scripts:**

| Script | Señalización | HTTP/UI | Uso |
|--------|:---:|:---:|------|
| `jamkernelp2p.js` | ✅ | ❌ | Producción, relay puro |
| `jam-peer.js` | ✅ | ✅ | Demo, desarrollo |

**Soluciones:**
- Si necesitas UI web, usa `node jam-peer.js`
- Si necesitas ambos (kernel puro + HTTP), crear un script como:
  ```js
  const http = require('http');
  const { JAMOmni } = require('./jamkernelp2p.js');

  async function main() {
      const kernel = await JAMOmni.createKernel({});
      const id = await kernel.whenIdentityReady();

      // El kernel ya tiene _httpServer del signal
      const httpServer = kernel.platform._httpServer;
      if (httpServer) {
          httpServer.on('request', (req, res) => {
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(`jamkernelp2p peer: ${id.peerId}`);
          });
          if (!httpServer.listening) {
              httpServer.listen(8080, () => {
                  console.log('HTTP en :8080');
              });
          }
      }
  }
  main();
  ```

---

## Siguientes pasos

- [Guía de plugins](PLUGINS.md) — cómo extender jamkernelp2p con funcionalidad adicional
- [Manual de subida a GitHub](SUBIR_A_GITHUB.md) — publicar el proyecto profesionalmente
