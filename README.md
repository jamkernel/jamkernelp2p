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