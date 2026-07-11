<div align="center">
  <h1>jamkernelp2p v1.2.0</h1>
  <p><strong>J</strong>osé <strong>A</strong>lejandro <strong>M</strong>artínez</p>
  <p><em>Base mínima · Arquitectura pura · Cero dependencias</em></p>
  <p>
    <a href="#que-es">¿Qué es?</a> ·
    <a href="#arquitectura">Arquitectura</a> ·
    <a href="#quick-start">Quick Start</a> ·
    <a href="#api">API</a> ·
    <a href="#roadmap">Roadmap v2.1.0</a> ·
    <a href="#licencia">Licencia</a>
  </p>
  <p>
    <a href="https://github.com/jamkernel/jamkernelp2p" target="_blank">GitHub</a> ·
    <a href="mailto:jamkernelp2p@gmail.com">Contacto</a>
  </p>
  <br>
  <pre>node jamkernelp2p.js --room mi-sala --password clave-segura</pre>
  <br>
</div>

---

## ¿Qué es?

**jamkernelp2p** es un kernel de comunicación P2P en **un solo archivo (~2.200 líneas)** que funciona en **navegadores, Node.js, Deno y Bun** sin **ninguna dependencia externa**.

Creado por **Félix Martínez** y dedicado a su hijo José Alejandro Martínez.

No es un wrapper de WebRTC ni una adaptación de libp2p. Es una **arquitectura original** de microkernel P2P con capas de plataforma, identidad criptográfica, cifrado, transporte mesh y señalización embebida — todo en un solo archivo autocontenido.

### Filosofía

> "La verdadera descentralización no es un protocolo. Es la capacidad de cualquier persona, en cualquier lugar, con cualquier dispositivo, de comunicarse sin pedir permiso."

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    JAMKernelP2P (Orquestador)                 │
├─────────────┬──────────────┬──────────────┬──────────────────┤
│  Identity   │    Mesh      │    Crypto    │  Persistence     │
│  (ECDSA     │  (SecureJam  │  (AES-256    │  (BatchStorage   │
│   P-256)    │   Mesh Adap) │   GCM +      │   + estado)      │
│             │              │   PBKDF2)    │                  │
├─────────────┴──────────────┴──────────────┴──────────────────┤
│                  Capa de Transporte                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Browser  │  │ Node.js  │  │  Deno    │  │   Bun    │    │
│  │ (WebRTC) │  │(WebSocket│  │(WebSocket│  │(WebSocket│    │
│  │          │  │ +Relay)  │  │ +Relay)  │  │ +Relay)  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
├──────────────────────────────────────────────────────────────┤
│            MiniSignalServer (embebido, RFC 6455)              │
│  WebSocket signaling + mesh relay + auth + rate limit        │
└──────────────────────────────────────────────────────────────┘
```

Cada capa es independiente. Puedes reemplazar el MiniSignalServer por un relay externo sin tocar el mesh, la identidad, ni el cifrado.

### Componentes del Kernel

| Clase | Función |
|-------|---------|
| `IPlatform` / adapters | Abstracción multiplataforma (Browser, Node, Deno, Bun) |
| `EventBus` | Sistema de eventos asíncrono, desacopla componentes |
| `JamCrypto` | AES-256-GCM + PBKDF2(60K) + ECDSA P-256 |
| `IdentityManager` | Claves ECDSA, peerId = SHA-256(publicKey) |
| `MiniSignalServer` | Signaling WebSocket RFC 6455 zero-deps |
| `SecureJamMeshAdapter` | Mesh P2P con WebRTC + relay + ACKs + rate limiting |
| `BatchStorage` | Persistencia (IndexedDB / archivo JSON) |
| `WorkerPool` | Cola de tareas con concurrencia limitada |
| `PluginManager` | Sistema de plugins extensible |
| `StructuredLogger` | Logging con niveles y rotación |

## Lo que hace ahora (v1.2.0)

- **0 dependencias externas** — solo APIs nativas de cada plataforma
- **WebSocket RFC 6455 propio** — servidor + cliente + framing desde cero
- **Cifrado real** — AES-256-GCM + PBKDF2(60K) + ECDSA P-256
- **Mesh P2P** — WebRTC browser-to-browser; relay WebSocket en Node.js
- **Servidor de señalización embebido** — arranca con `--port`
- **Anti-DoS** — rate limiting 60 msg/s + blacklist automática
- **ACKs con reintentos** — entrega confirmada (hasta 2 reintentos)
- **CLI completo** — `--port --room --password --tls-key --tls-cert --log-file --log-level --help`
- **Multiplataforma** — browser, Node.js, Deno, Bun
- **Persistencia de identidad** — ECDSA se guarda automáticamente
- **Plugins** — sistema de extensiones vía `JAMPlugin`

## Lo que viene: v2.1.0 (próximamente)

> **Lanzamiento en las próximas semanas.** Esta versión eleva el kernel a capacidades de producción con nuevas funcionalidades y pulido profesional.

| Mejora | Estado |
|--------|--------|
| **Omni-Kernel branding** | Nombre unificado: JAM Omni-Kernel |
| **Autenticación por token** | `--token` para salas con acceso restringido |
| **Cluster mode real** | Distribución de peers entre workers vía IPC |
| **Canales virtuales** | API unificada WebRTC DataChannel + WebSocket relay |
| **Purga forense mejorada** | Sobrescritura de claves en RAM al cerrar sesión |
| **Idle timeout** | Desconexión automática por inactividad (5 min) |
| **Límite de payload** | 256KB máximo por mensaje |
| **Reconexión automática** | Reintento periódico al signal server |
| **Documentación completa** | Manual, plugins, troubleshooting |

---

## Instalación

No necesitas `npm install`. Este proyecto tiene **cero dependencias**. Solo descarga el archivo y ejecútalo:

```bash
# Opción 1: Desde GitHub (sin clonar)
curl -O https://raw.githubusercontent.com/jamkernel/jamkernelp2p/main/jamkernelp2p.js
node jamkernelp2p.js --room mi-sala --password clave-segura

# Opción 2: Clonar el repo
git clone https://github.com/jamkernel/jamkernelp2p.git
cd jamkernelp2p
node jamkernelp2p.js --room mi-sala --password clave-segura
```

El `package.json` incluido es solo para metadatos — no hay dependencias que instalar.

## Quick Start

```bash
# Peer + servidor de señalización + mesh (todo en uno)
node jamkernelp2p.js --room mi-sala --password clave-segura

# Con puerto específico
node jamkernelp2p.js --port 9090 --room privado --password clave

# TLS para producción
node jamkernelp2p.js --tls-key cert.pem --tls-cert cert.pem --port 443

# Logging
node jamkernelp2p.js --log-file jam.log --log-level info --room test --password 12345678

# Ayuda
node jamkernelp2p.js --help
```

### Opciones CLI

| Flag | Default | Descripción |
|------|---------|-------------|
| `--port N` | `0` (aleatorio) | Puerto del servidor de señalización |
| `--room X` | — | Sala a la que unirse |
| `--password X` | — | Contraseña de cifrado (mín. 8 caracteres) |
| `--tls-key FILE` | — | Clave TLS para WSS |
| `--tls-cert FILE` | — | Certificado TLS para WSS |
| `--log-file FILE` | — | Archivo de log (JSON lines) |
| `--log-level L` | `warn` | `error`, `warn`, `info`, `debug` |
| `--host H` | `0.0.0.0` | Host del servidor |
| `--help`, `-h` | — | Muestra ayuda |

---

## API

```js
const { JAMOmni } = require('./jamkernelp2p.js');

// Creación auto-configurada
const kernel = await JAMOmni.createKernel({});

// Esperar a que la identidad esté lista
const peerId = await kernel.whenIdentityReady();
console.log('Peer ID:', peerId);

// Escuchar mensajes
kernel.events.on('peer:message', ({ peerId, message }) => {
    console.log(`${peerId}:`, message);
});

// Unirse a una sala cifrada
await kernel.startSession('mi-sala', 'mi-clave');

// Transmitir a todos
await kernel.broadcast({ text: 'Hola mundo P2P!' });

// Enviar a un peer específico
await kernel.sendTo(peerId, { text: 'Mensaje directo' });

// Cerrar sesión (purga de claves)
await kernel.closeSession();
```

### Plugins

```js
const { JAMPlugin } = require('./jamkernelp2p.js');

class MiPlugin extends JAMPlugin {
    async init(config) {
        this.events.on('peer:message', (msg) => {
            this.log.info('Plugin:', msg);
        });
    }
}

kernel.registerPlugin('mi-plugin', MiPlugin);
await kernel.loadPlugin('mi-plugin', { opcion: 'valor' });
```

---

## Uso en otras plataformas

### Navegador (Browser)

```html
<script src="jamkernelp2p.js"></script>
<script>
(async () => {
  const kernel = await window.JAM.Omni.createKernel({
    signalUrl: 'ws://servidor:puerto'
  });

  const peerId = await kernel.whenIdentityReady();
  console.log('Peer ID:', peerId);

  kernel.events.on('peer:message', ({ peerId, message }) => {
    console.log(`${peerId}:`, message);
  });

  await kernel.startSession('mi-sala', 'mi-clave');
  await kernel.broadcast({ text: 'Hola desde el navegador!' });
})();
</script>
```

### Deno

```ts
// deno run --allow-net --allow-write --allow-read jamkernelp2p.js
import { JAMOmni } from './jamkernelp2p.js';

const kernel = await JAMOmni.createKernel({
  room: 'mi-sala',
  password: 'clave-segura'
});

const peerId = await kernel.whenIdentityReady();
console.log('Peer ID:', peerId);
```

### Bun

```bash
bun jamkernelp2p.js --room mi-sala --password clave-segura
```

```ts
// Uso programático en Bun
import { JAMOmni } from './jamkernelp2p.js';

const kernel = await JAMOmni.createKernel({
  room: 'mi-sala',
  password: 'clave-segura'
});
```

---

## Comparativa vs Ecosistema

| Característica | jamkernelp2p | libp2p | PeerJS | simple-peer |
|---------------|:---:|:------:|:------:|:-----------:|
| Archivos | **1** | 100+ | 5+ | 3+ |
| Dependencias | **0** | 50+ | 10+ | 5+ |
| Browser + Node.js | ✅ | ✅ | ✅ | ✅ |
| Deno + Bun | ✅ | ❌ | ❌ | ❌ |
| Señalización embebida | ✅ | ❌ | ❌ | ❌ |
| Identidad ECDSA nativa | ✅ | Opcional | ❌ | ❌ |
| TLS nativo (WSS) | ✅ | ❌ | ❌ | ❌ |
| Logging estructurado | ✅ | ❌ | ❌ | ❌ |
| ACKs de entrega | ✅ | Opcional | ❌ | ❌ |
| Rate limiting anti-DoS | ✅ | Plugin | ❌ | ❌ |
| Persistencia de estado | ✅ | ❌ | ❌ | ❌ |
| Plugins | ✅ | ✅ | ❌ | ❌ |
| Zero-config CLI | ✅ | ❌ | ❌ | ❌ |

---

## Problemas Comunes

### El peer no conecta al servidor de señalización

Verificar puerto abierto y firewall. El servidor muestra el puerto en consola al arrancar.

### "Firma inválida" en announce

La identidad ECDSA no coincide con la clave pública enviada. O el peer fue comprometido o hay un error de clave. Limpiar `mesh._peerPublicKeys` si es falso positivo.

### Rate limiting activado

60 msg/s por peer. Si es falso positivo (ej. transferencia rápida de datos), ajustar:
```js
kernel.mesh.MAX_MESSAGES_PER_SECOND = 120;
```

### La identidad se pierde al recargar el navegador

La identidad se persiste en BatchStorage. Si el usuario borra datos del sitio, genera una nueva. Para persistencia forzada, exportar con `identity.toJSON()` y guardar en localStorage.

---

## Contacto y Comunidad

| Canal | Enlace |
|-------|--------|
| 📩 Correo | jamkernelp2p@gmail.com |
| 🐙 GitHub | https://github.com/jamkernel/jamkernelp2p |
| ✈️ Telegram (contacto) | https://t.me/jamkernelp2p |
| 📢 Canal Telegram | https://t.me/boost/jamkernelp2p_proyecto |
| 🌐 Sitio Web | https://jamkernel.github.io |

---

## Licencia

**GNU GPL v3** — Eres libre de usar, modificar y distribuir este software bajo los términos de GNU GPL v3.

Para uso en productos propietarios, contactar a **jamkernelp2p@gmail.com**.

---

<div align="center">
  <sub>Creado por <strong>Félix Martínez</strong> · 2026</sub>
  <br>
  <sub>Dedicado a José Alejandro Martínez — motor e inspiración ❤️</sub>
</div>
