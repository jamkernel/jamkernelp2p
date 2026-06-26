# Guía de plugins — jamkernelp2p

Cómo extender jamkernelp2p con plugins, crear la base de datos para almacenar datos de plugins,
y cubrir funcionalidades adicionales como cifrado avanzado, archivos, o integraciones.

---

## Índice

1. [Arquitectura de plugins](#1-arquitectura-de-plugins)
2. [Crear un plugin básico](#2-crear-un-plugin-básico)
3. [API disponible para plugins](#3-api-disponible-para-plugins)
4. [BatchStorage: la base de datos de plugins](#4-batchstorage-la-base-de-datos-de-plugins)
5. [Plugin de cifrado avanzado](#5-plugin-de-cifrado-avanzado)
6. [Plugin de persistencia de datos](#6-plugin-de-persistencia-de-datos)
7. [Plugin de integración REST](#7-plugin-de-integración-rest)
8. [Plugin de logging y monitoreo](#8-plugin-de-logging-y-monitoreo)
9. [Plugin con WorkerPool (tareas pesadas)](#9-plugin-con-workerpool-tareas-pesadas)
10. [Mejores prácticas](#10-mejores-prácticas)

---

## 1. Arquitectura de plugins

Los plugins en jamkernelp2p extienden la clase base `JAMPlugin` y reciben un contexto con acceso controlado al kernel:

```
Plugin
└── context
    ├── events     ← EventBus (comunicación desacoplada)
    ├── crypto     ← JamCrypto (cifrado/descifrado)
    ├── mesh       ← SecureJamMeshAdapter (enviar/recibir)
    ├── cache      ← Cache (caché en memoria)
    ├── log        ← Logger (console.log wrappeado)
    └── config     ← Configuración específica del plugin
```

El plugin **no tiene acceso directo** al kernel, a la plataforma, ni a otros plugins.
La comunicación entre plugins se hace exclusivamente vía EventBus.

### Ciclo de vida

1. **Registro:** `kernel.registerPlugin('nombre', ClasePlugin)`
2. **Carga:** `await kernel.loadPlugin('nombre', { config })` → llama a `plugin.init(config)`
3. **Uso:** el plugin funciona, emite/escucha eventos
4. **Descarga:** `await kernel.unloadPlugin('nombre')` → llama a `plugin.destroy()`
5. **Limpieza:** el kernel llama a `destroy()` de todos los plugins al cerrar sesión

---

## 2. Crear un plugin básico

```js
const { JAMPlugin } = require('./jamkernelp2p.js');

class MiPlugin extends JAMPlugin {
    async init(config) {
        // Configuración específica
        this.prefix = config.prefix || '[Plugin]';

        // Escuchar eventos
        this.events.on('peer:message', (msg) => {
            this.log.info(`${this.prefix} Mensaje de ${msg.senderId}:`, msg.message);
        });

        // Emitir eventos propios
        this.events.emit('miplugin:ready', { version: '1.0' });
    }

    async destroy() {
        // Limpiar recursos
        this.log.info(`${this.prefix} Plugin destruido`);
    }

    // Método público accesible desde fuera
    saludar(texto) {
        this.log.info(`${this.prefix} ${texto}`);
    }
}

// Registrar y cargar
kernel.registerPlugin('mi-plugin', MiPlugin);
const instancia = await kernel.loadPlugin('mi-plugin', { prefix: '[jamkernelp2p]' });
instancia.saludar('Hola desde el plugin!');
```

---

## 3. API disponible para plugins

Dentro del plugin, tienes acceso a:

### `this.events` — EventBus

```js
// Escuchar eventos del kernel
this.events.on('peer:connected', ({ peerId }) => {});
this.events.on('peer:message', ({ peerId, senderId, message, timestamp }) => {});
this.events.on('mesh:joined', ({ roomId }) => {});
this.events.on('mesh:left', ({ roomId }) => {});

// Escuchar señalización
this.events.on('signal:peer_joined', ({ peerId }) => {});
this.events.on('signal:peer_list', ({ peers }) => {});

// Emitir eventos personalizados (para comunicación entre plugins)
this.events.emit('miplugin:dato_actualizado', { clave: 'valor' });
this.events.emit('miplugin:error', { error: 'descripción' });
```

### `this.crypto` — JamCrypto

```js
// Cifrar/descifrar datos del plugin
const clave = await this.crypto.deriveKey('password-plugin', 'salt-plugin');
const cifrado = await this.crypto.encrypt('datos sensibles', clave);
const descifrado = await this.crypto.decrypt(cifrado, clave);
```

### `this.mesh` — SecureJamMeshAdapter

```js
// Acceso al mesh (solo lectura recomendada)
this.mesh.getPeers();           // peers conectados
this.mesh.getPeerCount();       // número de peers
this.mesh.isJoined();           // si está en una sala
this.mesh.roomId;               // sala actual
```

### `this.cache` — Cache

```js
// Caché propia del plugin
this.cache.set(`miplugin:dato`, valor, 30000); // TTL 30s
const valor = this.cache.get(`miplugin:dato`);
```

### `this.log` — Logger

```js
this.log.error('Error crítico');
this.log.warn('Advertencia');
this.log.info('Información');
this.log.debug('Depuración');
```

### `this.config` — Configuración

```js
// Objeto con la configuración pasada al cargar el plugin
// { opcion1: 'valor1', opcion2: 'valor2', ... }
```

---

## 4. BatchStorage: la base de datos de plugins

BatchStorage es el sistema de almacenamiento persistente de jamkernelp2p.
Es la base de datos que tus plugins pueden usar para guardar estado,
configuración, datos de usuarios, historial, etc.

### Crear una instancia de almacenamiento para tu plugin

```js
class PluginConDB extends JAMPlugin {
    async init(config) {
        // Crear almacenamiento propio del plugin
        // Se puede crear una instancia por plugin o usar una compartida
        this.db = new BatchStorage(null, {
            maxQueueSize: 500,
            maxMemoryItems: 2000
        });

        // Cargar estado guardado
        const estado = await this.db.get('estado') || {};
        this.contador = estado.contador || 0;

        this.log.info(`Plugin iniciado, contador: ${this.contador}`);
    }

    async incrementar() {
        this.contador++;
        await this.db.put('estado', { contador: this.contador });
        this.events.emit('plugin:contador_actualizado', { valor: this.contador });
    }

    async destroy() {
        await this.db.clear();
    }
}
```

### Esquemas de almacenamiento recomendados

Cada plugin debería usar su propio namespace para las claves:

```js
// Formato recomendado: "nombreplugin:dominio:clave"
await db.put('chat:mensajes:room1', [...]);
await db.put('chat:usuarios:room1', [...]);
await db.put('files:metadata:uuid-123', { name: 'foto.jpg', size: 1024 });
await db.put('config:preferencias', { theme: 'dark', lang: 'es' });
```

### Ejemplo: Plugin con modelo de datos completo

```js
class GestorTareas extends JAMPlugin {
    async init(config) {
        this.db = new BatchStorage(null);

        // Asegurar esquema inicial
        const schema = await this.db.get('schema_version');
        if (!schema) {
            await this.db.put('schema_version', 1);
            await this.db.put('tareas', []);
            await this.db.put('proyectos', {});
            this.log.info('Esquema inicial creado');
        }
    }

    // CRUD de tareas
    async addTask(tarea) {
        const tareas = await this.db.get('tareas') || [];
        tarea.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        tarea.createdAt = Date.now();
        tareaestado = 'pendiente';
        tareas.push(tarea);
        await this.db.put('tareas', tareas);
        this.events.emit('tareas:added', tarea);
        return tarea;
    }

    async getTasks() {
        return await this.db.get('tareas') || [];
    }

    async completeTask(id) {
        const tareas = await this.db.get('tareas') || [];
        const idx = tareas.findIndex(t => t.id === id);
        if (idx >= 0) {
            tareas[idx].estado = 'completada';
            tareas[idx].completedAt = Date.now();
            await this.db.put('tareas', tareas);
            this.events.emit('tareas:completed', tareas[idx]);
        }
    }
}
```

### Compartir datos entre plugins

Los plugins pueden compartir datos a través de EventBus o usando BatchStorage con convención de nombres:

```js
// Plugin A escribe
await db.put('shared:configuracion', { modo: 'seguro' });
this.events.emit('shared:config_actualizada', { modo: 'seguro' });

// Plugin B lee
const config = await db.get('shared:configuracion');
this.events.on('shared:config_actualizada', (data) => {
    // Actualizar estado interno
});
```

---

## 5. Plugin de cifrado avanzado

Para aplicaciones que necesitan capas adicionales de protección (más allá del AES-256-GCM por defecto):

```js
class CifradoAvanzadoPlugin extends JAMPlugin {
    async init(config) {
        // Clave maestra del plugin (derivada de config)
        this.masterKey = config.masterKey || 'clave-por-defecto-cambiar';
        this.salt = config.salt || 'jam-advanced-crypto';

        // Derivar clave AES
        this.pluginKey = await this.crypto.deriveKey(this.masterKey, this.salt);

        // Interceptar mensajes para cifrado adicional
        this.events.on('mesh:peer_discovered', ({ peerId }) => {
            this.log.info(`Peer descubierto: ${peerId}, intercambiando claves...`);
            this.events.emit('crypto:intercambio_iniciado', { peerId });
        });

        // Escuchar mensajes con doble cifrado
        this.events.on('peer:message', async ({ peerId, message }) => {
            if (message.type === 'crypto_handshake') {
                await this.procesarHandshake(peerId, message);
            }
            if (message.type === 'doble_cifrado') {
                const descifrado = await this.descifrarMensaje(message.payload);
                this.events.emit('crypto:doble_cifrado_recibido', {
                    peerId,
                    data: descifrado
                });
            }
        });
    }

    async cifrarMensaje(texto) {
        // Doble cifrado: AES-256-GCM sobre el cifrado existente
        const primeraCapa = await this.crypto.encrypt(texto, this.pluginKey);
        return primeraCapa; // Se envía como payload adicional
    }

    async descifrarMensaje(payload) {
        return await this.crypto.decrypt(payload, this.pluginKey);
    }

    async procesarHandshake(peerId, message) {
        // Intercambio de claves efímeras vía ECDH
        this.events.emit('crypto:handshake_completado', { peerId });
    }

    async destroy() {
        // Purga forense de la clave del plugin
        await this.crypto.purgeKeyFromMemory(this, 'pluginKey');
    }
}
```

---

## 6. Plugin de persistencia de datos

Plugin completo para guardar y sincronizar datos entre peers usando el mesh:

```js
class PersistenciaPlugin extends JAMPlugin {
    async init(config) {
        this.db = new BatchStorage(null);
        this.colecciones = config.colecciones || ['documentos', 'notas', 'config'];
        this.sincronizando = false;

        // Inicializar colecciones
        for (const col of this.colecciones) {
            const existe = await this.db.get(`col:${col}:meta`);
            if (!existe) {
                await this.db.put(`col:${col}:meta`, {
                    nombre: col,
                    creada: Date.now(),
                    count: 0
                });
            }
        }

        // Escuchar solicitudes de sincronización
        this.events.on('peer:message', async ({ peerId, message }) => {
            if (message.type === 'sync_request' && message.coleccion) {
                await this.enviarColeccion(peerId, message.coleccion);
            }
            if (message.type === 'sync_data') {
                await this.recibirDatos(message.coleccion, message.datos);
            }
        });
    }

    // CRUD genérico
    async insertar(coleccion, documento) {
        if (!this.colecciones.includes(coleccion)) throw new Error(`Colección ${coleccion} no existe`);

        const docs = await this.db.get(`col:${coleccion}:datos`) || [];
        documento._id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        documento._created = Date.now();
        documento._updated = Date.now();
        docs.push(documento);

        await this.db.put(`col:${coleccion}:datos`, docs);
        await this.db.put(`col:${coleccion}:meta`, {
            nombre: coleccion,
            count: docs.length,
            ultimaMod: Date.now()
        });

        // Notificar al mesh
        this.events.emit('persistencia:insertado', { coleccion, id: documento._id });
        return documento;
    }

    async obtener(coleccion, query = {}) {
        const docs = await this.db.get(`col:${coleccion}:datos`) || [];
        if (Object.keys(query).length === 0) return docs;
        return docs.filter(d => Object.entries(query).every(([k, v]) => d[k] === v));
    }

    async actualizar(coleccion, id, cambios) {
        const docs = await this.db.get(`col:${coleccion}:datos`) || [];
        const idx = docs.findIndex(d => d._id === id);
        if (idx === -1) throw new Error(`Documento ${id} no encontrado`);

        docs[idx] = { ...docs[idx], ...cambios, _updated: Date.now() };
        await this.db.put(`col:${coleccion}:datos`, docs);
        this.events.emit('persistencia:actualizado', { coleccion, id });
        return docs[idx];
    }

    async eliminar(coleccion, id) {
        const docs = await this.db.get(`col:${coleccion}:datos`) || [];
        const filtrados = docs.filter(d => d._id !== id);
        await this.db.put(`col:${coleccion}:datos`, filtrados);
        this.events.emit('persistencia:eliminado', { coleccion, id });
    }

    // Sincronización P2P
    async sincronizar(peerId) {
        if (this.sincronizando) return;
        this.sincronizando = true;

        for (const col of this.colecciones) {
            // Solicitar datos del peer
            this.events.emit('mesh:enviar', {
                target: peerId,
                data: { type: 'sync_request', coleccion: col }
            });
        }

        this.sincronizando = false;
    }

    async enviarColeccion(peerId, coleccion) {
        const datos = await this.db.get(`col:${coleccion}:datos`) || [];
        this.events.emit('mesh:enviar', {
            target: peerId,
            data: { type: 'sync_data', coleccion, datos }
        });
    }

    async recibirDatos(coleccion, datos) {
        if (!datos || datos.length === 0) return;
        const locales = await this.db.get(`col:${coleccion}:datos`) || [];

        // Merge simple: los datos remotos reemplazan si son más recientes
        for (const doc of datos) {
            const idx = locales.findIndex(l => l._id === doc._id);
            if (idx === -1) {
                locales.push(doc);
            } else if (doc._updated > locales[idx]._updated) {
                locales[idx] = doc;
            }
        }

        await this.db.put(`col:${coleccion}:datos`, locales);
        this.log.info(`Sincronizados ${datos.length} documentos en ${coleccion}`);
        this.events.emit('persistencia:sincronizado', { coleccion, count: datos.length });
    }

    async destroy() {
        await this.db.put('persistencia:ultimo_cierre', Date.now());
    }
}
```

---

## 7. Plugin de integración REST

Para exponer datos del mesh vía HTTP (útil en Node.js):

```js
class RESTPlugin extends JAMPlugin {
    async init(config) {
        this.port = config.port || 8080;
        this.db = new BatchStorage(null);

        if (typeof require !== 'undefined') {
            const http = require('http');
            this.server = http.createServer((req, res) => {
                this.manejarPeticion(req, res);
            });
            this.server.listen(this.port, () => {
                this.log.info(`API REST en http://localhost:${this.port}`);
            });
        }

        // Escuchar eventos y actualizar API
        this.events.on('peer:message', async ({ peerId, message }) => {
            const historial = await this.db.get('rest:historial') || [];
            historial.push({ peerId, message, ts: Date.now() });
            await this.db.put('rest:historial', historial.slice(-500));
        });
    }

    async manejarPeticion(req, res) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');

        try {
            if (req.url === '/api/peers') {
                res.end(JSON.stringify({
                    peers: this.mesh.getPeers(),
                    count: this.mesh.getPeerCount()
                }));
            } else if (req.url === '/api/historial') {
                const historial = await this.db.get('rest:historial') || [];
                res.end(JSON.stringify(historial));
            } else if (req.url === '/api/estado') {
                res.end(JSON.stringify({
                    conectado: this.mesh.isJoined(),
                    sala: this.mesh.roomId,
                    peers: this.mesh.getPeerCount()
                }));
            } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
            }
        } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    async destroy() {
        if (this.server) this.server.close();
    }
}
```

---

## 8. Plugin de logging y monitoreo

Para entornos profesionales que requieran auditoría:

```js
class MonitoreoPlugin extends JAMPlugin {
    async init(config) {
        this.db = new BatchStorage(null);
        this.metrics = {
            mensajesEnviados: 0,
            mensajesRecibidos: 0,
            peersConectados: 0,
            errores: 0,
            inicio: Date.now()
        };

        // Registrar eventos del sistema
        const eventos = [
            'peer:connected', 'peer:disconnected', 'peer:message',
            'peer:attack_detected', 'peer:bad_signature',
            'mesh:joined', 'mesh:left', 'mesh:no_peers',
            'signal:peer_joined', 'signal:peer_left',
            'signal:connection_error',
            'kernel:ready', 'kernel:closed'
        ];

        for (const evento of eventos) {
            this.events.on(evento, (data) => {
                this.registrarEvento(evento, data);
            });
        }
    }

    async registrarEvento(tipo, data) {
        const log = await this.db.get('monitoreo:log') || [];

        log.push({
            tipo,
            timestamp: Date.now(),
            data: this.sanitizar(data)
        });

        // Mantener solo últimos 10000 eventos
        await this.db.put('monitoreo:log', log.slice(-10000));

        // Actualizar métricas
        if (tipo === 'peer:message') this.metrics.mensajesRecibidos++;
        if (tipo === 'peer:connected') this.metrics.peersConectados++;
        if (tipo === 'peer:disconnected') this.metrics.peersConectados--;
        if (tipo.includes('error') || tipo.includes('attack') || tipo.includes('bad')) {
            this.metrics.errores++;
        }
    }

    sanitizar(data) {
        // No guardar datos sensibles
        const safe = { ...data };
        delete safe.password;
        delete safe.key;
        delete safe.secret;
        return safe;
    }

    async getReporte() {
        const log = await this.db.get('monitoreo:log') || [];
        const errores = log.filter(e =>
            e.tipo.includes('error') || e.tipo.includes('attack')
        );

        return {
            uptime: Date.now() - this.metrics.inicio,
            metrics: this.metrics,
            ultimosErrores: errores.slice(-10),
            actividadUltimaHora: log.filter(e =>
                e.timestamp > Date.now() - 3600000
            ).length
        };
    }

    async destroy() {
        await this.registrarEvento('plugin:destroyed', {});
    }
}
```

---

## 9. Plugin con WorkerPool (tareas pesadas)

Para operaciones intensivas que no deben bloquear el mesh:

```js
class AnalisisPlugin extends JAMPlugin {
    async init(config) {
        this.workerPool = kernel.workerPool; // Acceso al pool de workers

        this.events.on('peer:message', async ({ peerId, message }) => {
            if (message.type === 'analisis') {
                // Delegar a worker para no bloquear
                const resultado = await this.workerPool.exec((datos) => {
                    // Este código corre en un worker sandbox
                    const text = datos.texto;
                    const palabras = text.split(/\s+/).length;
                    const caracteres = text.length;
                    const frecuencia = {};
                    for (const p of text.toLowerCase().match(/\w+/g) || []) {
                        frecuencia[p] = (frecuencia[p] || 0) + 1;
                    }
                    return { palabras, caracteres, frecuencia };
                }, { texto: message.text });

                this.events.emit('analisis:resultado', {
                    peerId,
                    resultado
                });
            }
        });
    }
}
```

---

## 10. Mejores prácticas

### Seguridad
- Nunca almacenar contraseñas o claves en texto plano en BatchStorage
- Usar `this.crypto.encrypt()` antes de guardar datos sensibles
- En `destroy()`, purgar claves y datos sensibles de memoria
- Validar y sanear todos los datos que llegan del mesh

### Nombres de eventos
Usar convención de nombres para evitar colisiones:

```
plugin:{nombre}:{acción}
└───── ────── ─────
  1      2       3
```
1. Prefijo fijo `plugin:`
2. Nombre del plugin (único)
3. Acción o evento específico

Ejemplos: `plugin:chat:mensaje_nuevo`, `plugin:files:transferencia_completa`

### Claves en BatchStorage
```
{nombre-plugin}:{dominio}:{identificador}
```

### Ciclo de vida
- `init()`: inicializar recursos, cargar estado, conectar eventos
- `destroy()`: liberar recursos, guardar estado, desconectar eventos
- Nunca asumir que `init()` se llamó (usar guards)

### Comunicación entre plugins
Siempre vía EventBus, nunca acceder directamente a otro plugin:

```js
// Plugin A
this.events.emit('plugin:a:dato_listo', { datos: [...] });

// Plugin B
this.events.on('plugin:a:dato_listo', ({ datos }) => {
    // Procesar datos de plugin A
});
```

### Manejo de errores
```js
async init(config) {
    try {
        this.db = new BatchStorage(null);
        await this.db.get('inicializado');
    } catch (e) {
        this.log.error(`Error iniciando plugin: ${e.message}`);
        // No relanzar — el plugin puede funcionar en modo degradado
    }
}
```

---

## ¡A construir!

Con esta guía tienes todo lo necesario para crear plugins que extiendan jamkernelp2p
en cualquier dirección: almacenamiento, cifrado, APIs, UI, analítica, etc.

La clave está en:
- **BatchStorage** como base de datos persistente
- **EventBus** como sistema de comunicación desacoplado
- **WorkerPool** para tareas pesadas sin bloquear el mesh
- **SecureJamMeshAdapter** para transmitir datos entre peers

```js
// Template mínimo para empezar
const { JAMPlugin } = require('./jamkernelp2p.js');

class MiPlugin extends JAMPlugin {
    async init(config) {
        this.db = new BatchStorage(null);
        this.log.info('Plugin iniciado');
    }
    async destroy() {
        this.log.info('Plugin destruido');
    }
}
module.exports = MiPlugin;
```
