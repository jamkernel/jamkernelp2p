# JAMKernelP2P — Motor P2P Completo

## Goal
Implementar un motor P2P funcional que cumpla todas las promesas de la documentación (WebSocket, ECDSA, mesh real, CLI, ACKs, plugins, cluster, logger), preservando la arquitectura original del proyecto jamkernelp2p.

## Constraints & Preferences
- Un solo archivo (`jamkernelp2p.js`), cero dependencias externas
- Preservar arquitectura actual (IPlatform → EventBus → JamCrypto → BatchStorage → SecureJamMeshAdapter → JAMKernelP2P)
- Mantener todas las APIs públicas existentes y el namespace `window.JAM`
- RFC 6455 manual, ECDSA con Web Crypto API nativa

## Progress
### Done
- **WebSocket RFC 6455**: Servidor (`_WebSocketServer` + `_WebSocketPeer`) y cliente (`_WebSocketClientNode`) desde cero, sin dependencias. Soporta frames enmascarados/no enmascarados, longitudes extendidas (16/64-bit), ping/pong, cierre.
- **IdentityManager ECDSA P-256**: Creación, exportación, firma, verificación con Web Crypto API nativa.
- **MiniSignalServer**: Servidor de señalización con salas, verificación de firmas ECDSA, mensajes relay, announce/peer_joined/peer_left.
- **SecureJamMeshAdapter**: Conectividad mesh con relay a través del signal server (Node.js) o WebRTC (browser). Cifrado AES-GCM con clave derivada por PBKDF2. Sistema de ACKs con reintentos y timeouts.
- **BatchStorage**: Persistencia para Node.js vía `fs`.
- **StructuredLogger**: Logger con niveles, rotación, timestamps ISO.
- **JAMOmni factory**: `createKernel(config)` con auto-inicialización.
- **CLI**: `node jamkernelp2p.js --help` con todas las flags documentadas.

### Bugs Fixed
1. **Recursión infinita en `init()`**: `_ready = true` movido antes del auto-join.
2. **DataView byteOffset en slices**: `new DataView(buf.buffer, buf.byteOffset, buf.byteLength)` para respetar slices no-cero.
3. **`_WebSocketFrame.encode` corrupto**: La primera pasada modificaba `header[0]` con bits de longitud, produciendo `0xFF` en vez de `0x81`. Reescribir con una sola pasada limpia.
4. **`_processBuffer` longitud extendida**: Para frames con `len === 126` or `127`, calculaba `totalLen` con el indicador de longitud en vez de leer los bytes extendidos. Se añadió lectura de `view.getUint16(2)` y 64-bit.
5. **ACKs sin cifrar**: `_sendAck` enviaba ACK en texto plano, pero `_decryptAndEmit` intentaba descifrarlo. Se cambió a cifrar el ACK antes de enviar.
6. **ACK sin envoltura relay**: `_sendEncryptedDirect` enviaba datos raw por el canal relay sin el envelope `{type:'relay_msg', to, data}`. Se añadió condición para transporte relay.
7. **`_handleAck` sin resolver promise**: El callback guardaba `resolve` pero nunca lo llamaba. Se añadió `pending.resolve()`.
8. **`_retryAck` sin `encrypted` almacenado**: `pending.encrypted` nunca se guardaba. Se añadió al Map entry.
9. **`socket.end()` en scope incorrecto**: En `_WebSocketClientNode._processBuffer`, `socket.end()` debería ser `this._socket.end()`.

### Key Files
- `jamkernelp2p.js` (~1991 líneas): motor completo
- `jam-peer.js`: demo wrapper (pendiente de actualizar)
- `public/index.html`: UI web demo (pendiente)

## Architecture
```
IPlatform → EventBus → JamCrypto
                           ↓
                    IdentityManager
                           ↓
                    BatchStorage
                           ↓
              SecureJamMeshAdapter ← MiniSignalServer ← _WebSocketServer ← _WebSocketPeer
                           ↓
                   JAMKernelP2P ← JAMOmni.createKernel()
                           ↓
                    PluginManager
```

## Test Commands
```bash
# 2-peer relay messaging
node -e "
const { JAMOmni } = require('./jamkernelp2p.js');
(async () => {
    const p1 = await JAMOmni.createKernel({port:0, host:'127.0.0.1', logLevel:'info'});
    await p1.startSession('room', 'password1234');
    const port = p1.signalServer.port;
    const p2 = await JAMOmni.createKernel({logLevel:'info', signalUrl:'ws://127.0.0.1:'+port});
    await p2.startSession('room', 'password1234');
    await new Promise(r => setTimeout(r, 300));
    p1.events.on('peer:message', ({message}) => console.log('P1:', message));
    p2.events.on('peer:message', ({message}) => console.log('P2:', message));
    await p1.sendTo(p2.identity.peerId, 'Hello!');
    await p2.sendTo(p1.identity.peerId, 'Hi!');
    await p1.broadcast('Broadcast');
    setTimeout(() => { p1.destroy(); p2.destroy(); process.exit(0); }, 500);
})();
"

# CLI help
node jamkernelp2p.js --help
```
