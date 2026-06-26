<div align="center">
  <h1>jamkernelp2p</h1>
  <p><strong>J</strong>osé <strong>A</strong>lejandro <strong>M</strong>artínez</p>
  <p>Un solo archivo · Cero dependencias · Mesh P2P cifrado · Multi-plataforma · Grado profesional</p>
  <p>
    <a href="#quick-start">Quick Start</a> ·
    <a href="#lo-nuevo">Lo Nuevo</a> ·
    <a href="#api">API</a> ·
    <a href="#cli">CLI</a> ·
    <a href="#arquitectura">Arquitectura</a> ·
    <a href="#problemas-comunes">Problemas Comunes</a> ·
    <a href="#licencia">Licencia</a>
  </p>
  <p>
    <a href="https://github.com/jamkernel/jamkernelp2p" target="_blank">GitHub</a> ·
    <a href="https://jamkernel.github.io/" target="_blank">Web</a> ·
    <a href="mailto:jamkernelp2p@gmail.com">Contacto</a>
  </p>
  <br>
  <pre>node jamkernelp2p.js --port 8080 --room mired --password secreto</pre>
  <br>
</div>

---

## ¿Qué es jamkernelp2p?

**jamkernelp2p** es un kernel de comunicación P2P en **un solo archivo JavaScript (~3500 líneas)** que funciona en **navegadores, Node.js, Deno y Bun** sin **ninguna dependencia externa**.

Creado por **Félix Martínez** y dedicado a su hijo José Alejandro Martínez — de ahí el nombre **JAM**.

A diferencia de libp2p, PeerJS o simple-peer, jamkernelp2p es **autocontenido**: copias el archivo, lo importas, y tienes una red mesh cifrada con identidad criptográfica, servidor de señalización embebido, logging estructurado, TLS, clustering, y persistencia de estado.

## Lo Nuevo (v2.1.0)

| Mejora | Descripción |
|--------|------------|
| **CLI completo** | `--port`, `--token`, `--room`, `--password`, `--cluster`, `--workers`, `--tls-key`, `--tls-cert`, `--log-file`, `--log-level`, `--help` |
| **Autenticación** | Firma ECDSA P-256 en announce, token de sala opcional, servidor verifica peerId |
| **TLS nativo** | `--tls-key cert.pem --tls-cert cert.pem` → WebSocket seguro (WSS) |
| **ACKs de entrega** | Cada mensaje lleva `_msgId`, el receptor responde ACK automático, el emisor trackea pendientes |
| **Rate limiting** | 60 msg/s por conexión, 256KB máx por mensaje, idle timeout 5 min, anti-DoS |
| **StructuredLogger** | Logs en JSON lines con rotación a 10MB, niveles: `error|warn|info|debug` |
| **Cluster mode** | `--cluster --workers 4` distribuye peers entre workers vía IPC |
| **Persistencia mesh** | Estado de sala y conexiones guardado/restaurado en BatchStorage automáticamente |
| **Seguridad mejorada** | Purga forense de claves en RAM al cerrar sesión, blacklist de peers maliciosos |
| **Canales virtuales** | NodeAdapter crea canales virtuales WebSocket con API idéntica a WebRTC DataChannel |

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                    jamkernelp2p                           │
├────────────┬──────────────┬──────────────┬───────────────┤
│  Identity  │    Mesh      │    Crypto    │  Persistence  │
│  (ECDSA    │  (SecureJam  │  (AES-256    │  (BatchStorage│
│   P-256)   │   Mesh Adap) │   GCM +      │   + estado    │
│            │              │   PBKDF2)    │   mesh)       │
├────────────┴──────────────┴──────────────┴───────────────┤
│                Capa de Transporte                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Browser  │  │  Node.js │  │   Deno   │  │   Bun    │ │
│  │ (WebRTC) │  │(WebSocket│  │(WebSocket│  │(WebSocket│ │
│  │          │  │ +Relay)  │  │ +Relay)  │  │ +Relay)  │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
├──────────────────────────────────────────────────────────┤
│            MiniSignalServer (embebido)                    │
│  WebSocket signaling + mesh relay + auth + rate limit    │
└──────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Clona o descarga el repositorio

# 2. Peer + servidor de señalización + mesh (todo en uno)
node jamkernelp2p.js --room mi-sala --password clave-segura

# 3. O usando jam-peer.js (demo con UI web)
node jam-peer.js
# Abre http://localhost:3000 en el navegador
```

## CLI (Línea de Comandos)

El kernel arranca como proceso independiente sin necesidad de código adicional:

```bash
# Uso básico
node jamkernelp2p.js --room chat-publico --password "v3r4-C0ntr4S3ñ4"

# Con puerto específico y token de sala
node jamkernelp2p.js --port 9090 --room privado --password clave \
  --token mi-token-secreto

# TLS (WSS) para producción
node jamkernelp2p.js --tls-key /etc/ssl/privkey.pem \
  --tls-cert /etc/ssl/cert.pem --port 443

# Cluster multi-worker
node jamkernelp2p.js --cluster --workers 4 --room sala-cluster \
  --password clave

# Logging profesional
node jamkernelp2p.js --log-file /var/log/jam.log --log-level info \
  --room monitoreo --password clave

# Ayuda completa
node jamkernelp2p.js --help
```

### Opciones

| Flag | Default | Descripción |
|------|---------|-------------|
| `--port N` | `0` (aleatorio) | Puerto del servidor de señalización |
| `--token X` | — | Token de autenticación para el servidor |
| `--room X` | — | Sala a la que unirse al iniciar |
| `--password X` | — | Contraseña de cifrado de la sala |
| `--tls-key FILE` | — | Clave TLS para WSS |
| `--tls-cert FILE` | — | Certificado TLS para WSS |
| `--cluster` | — | Activa modo multi-worker |
| `--workers N` | CPU count | Número de workers en cluster |
| `--log-file FILE` | — | Archivo de log (JSON lines) |
| `--log-level L` | `warn` | `error`, `warn`, `info`, `debug` |
| `--help`, `-h` | — | Muestra ayuda y sale |

## API

```js
const { JAMOmni } = require('./jamkernelp2p.js');

// Creación auto-configurada
const kernel = await JAMOmni.createKernel({});
const identity = await kernel.whenIdentityReady();
console.log('Peer ID:', identity.peerId);

// Escuchar mensajes
kernel.events.on('peer:message', ({ senderId, message }) => {
    console.log(`${senderId}:`, message);
});

// Unirse a una sala y transmitir
await kernel.startSession('mi-sala', 'mi-clave');
await kernel.broadcast({ text: 'Hola mundo P2P!' });

// Cerrar sesión (purga forense de claves)
await kernel.closeSession();
```

### Plugins

```js
class MiPlugin extends JAMPlugin {
    async init(config) {
        this.events.on('peer:message', (msg) => {
            this.log.info('Plugin recibió:', msg);
        });
    }
}
kernel.registerPlugin('mi-plugin', MiPlugin);
await kernel.loadPlugin('mi-plugin', { opcion: 'valor' });
```

## Problemas Comunes

### El peer no conecta con el servidor de señalización

**Causa:** Puerto incorrecto, firewall bloqueando, o URL mal configurada.

```
signal:connection_error → signal:reconnecting → signal:connection_failed
```

**Soluciones:**
- Verificar que el puerto esté abierto: `netstat -an | findstr :PUERTO`
- En Windows, agregar regla de firewall: `netsh advfirewall firewall add rule name="jamkernelp2p" dir=in action=allow protocol=TCP localport=PUERTO`
- Si usas WSS, verificar que TLS esté bien configurado: el certificado debe coincidir con el hostname
- Verificar que no haya otro proceso en el mismo puerto: `netstat -ano | findstr :PUERTO`

### "Firma inválida" / "peer:bad_signature"

**Causa:** El peer que envía no tiene la clave pública correcta registrada, o hay un ataque de suplantación.

**Soluciones:**
- Asegurarse de que `mesh.storePeerPublicKey()` se llame después de `peer:connected`
- El announce del peer incluye `peerId + signature` — si no coincide con `SHA-256(publicKey)`, el servidor rechaza
- Si es un error falso positivo, limpiar claves cacheadas: `mesh.clearVerifiedPeers()`
- En redes confiables, aumentar ventana de tolerancia en `handleIncomingPacket()`

### "peer:attack_detected" o rate limiting

**Causa:** Un peer envía más de 60 mensajes por segundo, o mensajes de más de 256KB.

**Soluciones:**
- El peer infractor entra en blacklist automática por 60 segundos (clase `_rateLimit`)
- No hay acción manual necesaria — el kernel se protege solo
- Si es un falso positivo (ej. transferencia de archivos), aumentar el límite:

```js
kernel.mesh.MAX_MESSAGES_PER_SECOND = 120;  // default: 60
```

### Mesh se desconecta al recargar el navegador

**Causa:** La identidad ECDSA se pierde si no hay IndexedDB o si el almacenamiento fue borrado.

**Soluciones:**
- La identidad se persiste automáticamente en BatchStorage (IndexedDB en browser, memoria en Node.js)
- Si el usuario borra datos del sitio, genera una nueva identidad — es normal que aparezca como peer nuevo
- Para persistencia forzada, exportar/importar identidad:

```js
const json = identity.toJSON();
// Guardar json en localStorage antes de recargar
localStorage.setItem('jam-identity', JSON.stringify(json));

// Al cargar de nuevo:
const saved = JSON.parse(localStorage.getItem('jam-identity'));
await identity.importIdentity(
    new Uint8Array(saved.publicKey),
    new Uint8Array(saved.privateKey)
);
```

### Cluster: workers no se comunican entre sí

**Causa:** El cluster usa IPC de Node.js (proceso primario como relay). Si un worker cae, sus peers quedan huérfanos.

**Soluciones:**
- El primario reenvía automáticamente eventos `peer_joined`, `peer_left` y mensajes mesh entre workers
- Si un worker muere, el primario notifica a los demás con `peer_left` para cada peer de ese worker
- Verificar que todos los workers usen el mismo `--token` si el servidor tiene autenticación
- Para clústeres grandes (>1000 peers), considera un message broker externo (NATS, Redis Pub/Sub)

### Los logs no se escriben al archivo

**Causa:** Permisos de escritura, ruta incorrecta, o directorio no existe.

**Soluciones:**
- Verificar que el directorio padre exista: `mkdir -p /var/log/jam`
- El archivo se crea automáticamente si no existe, pero el directorio debe existir
- Si se usa `--log-file ./logs/jam.log`, crear `logs/` antes de arrancar
- El archivo rota automáticamente al llegar a 10MB (se renombra a `.1.log`)
- En Windows, usar rutas absolutas o relativas con barras invertidas escapadas

### TLS: "ERR_CERT_AUTHORITY_INVALID" en navegador

**Causa:** Certificado autofirmado no es aceptado por el navegador.

**Soluciones:**
- Para desarrollo, aceptar la excepción de seguridad manualmente
- Para producción, usar Let's Encrypt (certbot) o un CA confiable
- También funciona sin TLS en `ws://localhost` para desarrollo local

### El peer Node.js no sirve HTTP

**Causa:** `jam-peer.js` usa el mismo servidor HTTP del signal para servir archivos. Si arrancas solo el kernel vía CLI (`node jamkernelp2p.js`), no hay servidor HTTP.

**Soluciones:**
- Usa `jam-peer.js` si necesitas interfaz web
- El kernel CLI (`jamkernelp2p.js`) es solo señalización + mesh — más ligero pero sin UI
- Para ambos, crea tu propio script con `createKernel()` + servidor HTTP como en `jam-peer.js`

### Error: "No se pudo derivar la clave" / password muy corto

**Causa:** `startSession()` requiere password de al menos 8 caracteres.

**Soluciones:**
- Usar contraseñas de 12+ caracteres
- PBKDF2 con 60,000 iteraciones — passwords cortos son vulnerables a fuerza bruta
- Si es solo para pruebas: `await kernel.startSession('test', '12345678')`

### El mesh no descubre peers

**Causa:** Los peers están en redes diferentes sin relay, o el gossip no se propagó.

**Soluciones:**
- Verificar que todos los peers apunten al mismo servidor de señalización
- El servidor envía `peer_list` al conectarse y `peer_joined` cuando alguien nuevo llega
- Si hay NAT, asegurar que WebRTC tenga STUN configurado (por defecto tiene Google STUN)
- Para redes locales, usar IP directa: `signalServer: 'ws://192.168.1.100:PUERTO'`

## Comparativa

| Característica | jamkernelp2p | libp2p | PeerJS | simple-peer |
|---------------|:---:|:------:|:------:|:-----------:|
| Archivos | 1 | 100+ | 5+ | 3+ |
| Dependencias | **0** | 50+ | 10+ | 5+ |
| Browser + Node.js | ✅ | ✅ | ✅ | ✅ |
| Señalización embebida | ✅ | ❌ | ❌ | ❌ |
| Identidad ECDSA | ✅ | Opcional | ❌ | ❌ |
| TLS nativo | ✅ | ❌ | ❌ | ❌ |
| Cluster mode | ✅ | ✅ | ❌ | ❌ |
| Logging estructurado | ✅ | ❌ | ❌ | ❌ |
| ACKs de entrega | ✅ | ❌ | ❌ | ❌ |
| Rate limiting anti-DoS | ✅ | ❌ | ❌ | ❌ |
| Auto-descubrimiento | ✅ | ✅ | ❌ | ❌ |
| Persistencia de estado | ✅ | ❌ | ❌ | ❌ |
| Plugins sandbox | ✅ | ✅ | ❌ | ❌ |
| Deno + Bun | ✅ | ❌ | ❌ | ❌ |
| Zero-config | ✅ | ❌ | ❌ | ❌ |

## Licencia

**Dual License:** GNU GPL v3 + Commercial License.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Commercial License](https://img.shields.io/badge/License-Commercial-purple)](LICENCIA_COMERCIAL.md)

**Open Source (GPLv3):** Eres libre de usar, modificar y distribuir este software bajo los términos de GNU GPL v3. Ideal para proyectos de código abierto, uso personal, educativo, investigación y organizaciones sin fines de lucro. Ver [LICENSE](LICENSE).

**Comercial:** Si deseas usar jamkernelp2p en un producto propietario sin las restricciones de copyleft, puedes adquirir una licencia comercial directamente del autor. Ver [LICENCIA_COMERCIAL.md](LICENCIA_COMERCIAL.md) o contacta a **jamkernelp2p@gmail.com**.

---

<div align="center">
  <sub>Creado por <strong>Félix Martínez</strong> · 2026</sub>
  <br>
  <sub>Dedicado a José Alejandro Martínez — mi motor, mi orgullo ❤️</sub>
</div>
