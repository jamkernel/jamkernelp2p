# ⚛️ JAM Kernel

## El Ecosistema para la Comunicación y la IA Descentralizada

[![Version](https://img.shields.io/badge/version-1.2-blue.svg)](https://github.com/jamkernel/jamkernelp2p)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Platform](https://img.shields.io/badge/platform-Node.js%20%7C%20Deno%20%7C%20Bun%20%7C%20Web-blue)](https://jamkernel.github.io)

---

**JAM Kernel** no es un solo proyecto, sino una **familia de herramientas** que comparten la misma filosofía: **soberanía digital, ligereza extrema y control total**. Desde la comunicación P2P más básica hasta agentes de IA en el borde, el ecosistema JAM cubre todo el espectro de la computación descentralizada.

Este repositorio contiene el **Núcleo P2P** (`jamkernelp2p`), la base de todo el ecosistema. Un solo archivo JavaScript que te permite crear redes mesh cifradas sin servidores, sin dependencias y sin complejidad.

> 🚀 **El Motor Híbrido (Node.js + Rust)** — la evolución natural del núcleo — está en desarrollo. Consulta la [hoja de ruta](#hoja-de-ruta) para más información.

---

## 🌌 El Ecosistema JAM

### 🏛️ Núcleo P2P (jamkernelp2p) — v1.2

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

## 🔐 Núcleo P2P · Características

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

## 🚀 Uso Rápido

### Instalación

```bash
# Clona o descarga el repositorio
git clone https://github.com/jamkernel/jamkernelp2p.git
cd jamkernelp2p