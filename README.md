```markdown
# ⚛️ jamkernelp2p · v1.0

## Núcleo P2P Soberano — Código Abierto

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/jamkernel/jamkernelp2p)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/platform-Node.js%20%7C%20Deno%20%7C%20Bun%20%7C%20Web-blue)](https://jamkernel.github.io)
[![Telegram](https://img.shields.io/badge/Telegram-@jamkernelp2p-blue.svg)](https://t.me/jamkernelp2p)
[![Telegram Channel](https://img.shields.io/badge/Telegram-Canal-blue.svg)](https://t.me/boost/jamkernelp2p_proyecto)

---

**jamkernelp2p** es un núcleo de comunicación P2P en **un solo archivo JavaScript (~3500 líneas)** que funciona en **navegadores, Node.js, Deno y Bun** sin **ninguna dependencia externa**.

Creado por **Félix Martínez** y dedicado a su hijo José Alejandro Martínez — de ahí el nombre **JAM**.

A diferencia de libp2p, PeerJS o simple-peer, jamkernelp2p es **autocontenido** : copias el archivo, lo importas, y tienes una red mesh cifrada con identidad criptográfica, servidor de señalización embebido, logging estructurado, TLS, clustering, y persistencia de estado.

> 🚀 **El Motor Híbrido (Node.js + Rust)** — una evolución natural del núcleo — está en fase de investigación y desarrollo. Su lanzamiento está previsto como la versión **`2.0`** del ecosistema JAM. Consulta la [hoja de ruta](#hoja-de-ruta) para más información.

---

## 🌌 El Ecosistema JAM

### 🏛️ jamkernelp2p — v1.0 (Actual)

La base. Un solo archivo JavaScript para crear redes mesh cifradas sin dependencias.

- ✅ **1 archivo** · **0 dependencias**
- ✅ **4 plataformas** (Web/Node/Deno/Bun)
- ✅ **AES‑256‑GCM** con autenticación
- ✅ **Anti‑DoS** por rate limiting (12 msg/seg)
- ✅ **Purga forense** de claves en RAM
- ✅ **Identidad ECDSA** P‑256 nativa

[➡️ Ver documentación completa](https://jamkernel.github.io)

### 🚀 Motor Híbrido — v2.0 (En desarrollo)

La evolución del núcleo P2P: combina la flexibilidad de Node.js con el rendimiento de Rust para ejecutar agentes de IA, tareas programadas y lógica de negocio en el borde.

- ✅ **Agentes IA** en Rust
- ✅ **Scheduler** con cron
- ✅ **Tools nativas** (funciones en Rust)
- ✅ **Bridge Node.js ↔ Rust** en tiempo real

🔜 **Próximamente** — consulta la [hoja de ruta](#hoja-de-ruta).

---

## 🔐 Características del Núcleo (v1.0)

### Cifrado Militar

- **AES‑256‑GCM** con autenticación
- Derivación **PBKDF2** (60.000 iteraciones)
- **Sal dinámica** por sala
- **Identidad ECDSA** P‑256 nativa

### Seguridad Integrada

- **Anti‑DoS** por rate limiting (12 msg/seg)
- **Lista negra** automática
- **Sanitización** de entradas
- **Blacklist** de peers maliciosos

### Purga de Memoria

- **Eliminación forense** de claves en RAM
- **Garbage Collection** forzado
- **Nullificación** de referencias

### Almacenamiento Local

- **IndexedDB** con mutex antibloqueo
- **Backoff exponencial** en fallos
- **Límite de cola** (1000 items)

---

## 🚀 Uso Rápido (v1.0)

### Instalación

```bash
# Clona o descarga el repositorio
git clone https://github.com/jamkernel/jamkernelp2p.git
cd jamkernelp2p
```

Ejemplo Básico

```javascript
// Importar el núcleo
const { JAMOmniKernel } = require('./jamkernelp2p.js');

// Instanciar
const kernel = new JAMOmniKernel();

// Iniciar sesión
await kernel.startSession('mi-sala', 'mi-clave');

// Transmitir
await kernel.mesh.broadcast({ mensaje: 'Hola mundo P2P' });

// Recibir mensajes
kernel.events.on('peer:message', (data) => {
    console.log(`${data.peerId}:`, data.message);
});

// Cerrar sesión (purga forense)
await kernel.closeSession();
```

CLI (Línea de Comandos)

```bash
# Iniciar el núcleo como servidor
node jamkernelp2p.js --port 8080 --room mired --password secreto

# Ver todas las opciones
node jamkernelp2p.js --help
```

---

📊 Comparativa con el Ecosistema (v1.0)

Característica jamkernelp2p v1.0 libp2p PeerJS simple-peer
1 solo archivo ✅ ❌ 100+ ❌ 5+ ❌ 3+
Cero dependencias ✅ ❌ 50+ ❌ 10+ ❌ 5+
Deno + Bun ✅ ❌ ❌ ❌
Señalización embebida ✅ ❌ ❌ ❌
Identidad ECDSA nativa ✅ ⚠️ Opcional ❌ ❌
Rate limiting anti-DoS ✅ ⚠️ Plugin ❌ ❌
Purga forense de claves ✅ ❌ ❌ ❌
Puntuación Total 18/18 9/18 4/18 4/18

---

🗺️ Hoja de Ruta

✅ v1.0 — Núcleo P2P (Lanzado)

· Cifrado AES‑256‑GCM · PBKDF2
· Anti‑DoS · Purga forense de claves
· Multi‑entorno (Web/Node/Deno/Bun)
· Este es el jamkernelp2p actual.

🚧 v2.0 — Motor Híbrido (En desarrollo)

· Bridge Node.js ↔ Rust
· Agentes IA en Rust
· Scheduler cron
· Tools nativas · Memoria persistente

🔮 v3.0 — Escalabilidad y Producción

· Cluster mode para agentes
· NAT traversal completo (STUN/TURN)
· Integración con modelos de IA (ONNX, llama.cpp)

🌟 v4.0 — Ecosistema y Comunidad

· CLI para crear proyectos
· Repositorio de agentes/plugins
· Plataforma de despliegue descentralizado

---

🔄 Evolución Constante

jamkernelp2p no es un proyecto estático. Es un organismo vivo que crece, mejora y se adapta gracias al trabajo continuo de su creador y mantenedor.

Cada nueva versión incorpora aprendizajes, optimizaciones y nuevas capacidades para mantener el ecosistema a la vanguardia de la computación descentralizada.

Félix Martínez — autor y mantenedor activo — sigue desarrollando el proyecto con la misma pasión que lo inició, asegurando que jamkernelp2p sea siempre más ligero, más seguro y más potente.

---

🤝 Contribuciones

jamkernelp2p es un proyecto abierto que acepta contribuciones de todo tipo: código, documentación, seguridad y difusión.

📂 Enlaces Oficiales

Recurso Enlace
Repositorio GitHub github.com/jamkernel/jamkernelp2p
Sitio Web jamkernel.github.io
Correo Electrónico jamkernelp2p@gmail.com
Telegram (Contacto) @jamkernelp2p
Telegram (Canal) Canal del Proyecto

📋 ¿Cómo Contribuir?

1. Reporta errores abriendo un issue en GitHub.
2. Propón mejoras en el canal de Telegram o por correo.
3. Envía Pull Requests con correcciones o nuevas funcionalidades.
4. Difunde el proyecto en tus redes y comunidades.

---

📜 Licencia

Dual License: GNU GPL v3 + Commercial License.

Open Source (GPLv3): Eres libre de usar, modificar y distribuir este software bajo los términos de GNU GPL v3. Ideal para proyectos de código abierto, uso personal, educativo, investigación y organizaciones sin fines de lucro. Ver LICENSE.

Comercial: Si deseas usar jamkernelp2p en un producto propietario sin las restricciones de copyleft, puedes adquirir una licencia comercial directamente del autor. Contacta a jamkernelp2p@gmail.com.

---

❤️ Dedicatoria

Creado por Félix Martínez · 2026

Dedicado a José Alejandro Martínez — mi motor, mi orgullo ❤️

---

"Una nueva forma de entender la comunicación descentralizada: sin servidores, sin intermediarios, con control total del usuario sobre sus datos."

```

---