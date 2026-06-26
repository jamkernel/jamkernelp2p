# Contribuyendo a jamkernelp2p v1.2.0

Gracias por tu interés en contribuir a jamkernelp2p. Este proyecto es abierto y acepta contribuciones de todo tipo.

## Cómo contribuir

### Reportar bugs
Si encuentras un error, abre un issue en GitHub incluyendo:
- Descripción clara del problema
- Pasos para reproducirlo
- Entorno (navegador/Node.js/Deno, versión)
- Output del log si está disponible (`--log-level debug`)
- Si el error es de conexión, incluir el peerId y los eventos de consola

### Sugerir mejoras
Si tienes una idea para mejorar jamkernelp2p, abre un issue con la etiqueta "enhancement" describiendo:
- El problema que resuelve
- Cómo lo implementarías
- Si estás dispuesto a desarrollarlo
- Si afecta al core (zero-deps) o puede ser un plugin externo

### Áreas críticas a no romper

El kernel tiene 15+ fixes aplicados. Cambios en estas áreas REQUIEREN pruebas manuales:

| Área | Riesgo |
|------|--------|
| `Sandbox.onmessage` (WorkerPool) | Crash silencioso en workers |
| `pc.ondatachannel` (BrowserAdapter) | WebRTC no recibe canales entrantes |
| `BatchStorage` flush | Corrupción de datos compartidos |
| `identity.verify()` sin await | Falsos positivos de firma |
| `Mutex` dead code | Bloqueos perpetuos |
| `ws.onerror` + reconnect doble | Conexiones duplicadas |
| Duplicación de métodos mesh | Comportamiento impredecible |

### Enviar código

1. Haz un fork del repositorio
2. Crea una rama: `git checkout -b mi-mejora`
3. Haz tus cambios
4. Ejecuta validación básica:
   ```bash
   node -c jamkernelp2p.js                   # sintaxis
   node -e "require('./jamkernelp2p.js')"     # carga
   node -e "const j=require('./jamkernelp2p.js'); j.JAMOmni.createKernel({}).then(k=>k.destroy())"  # ciclo de vida
   ```
5. Si agregas flags al CLI, actualizar `MANUAL.md` y la sección `--help` en el kernel
6. Si agregas eventos, documentarlos en `MANUAL.md` sección API
7. Haz commit: `git commit -m "Descripción clara del cambio"`
8. Push: `git push origin mi-mejora`
9. Abre un Pull Request

### Reglas de estilo

- Código en JavaScript ES6+ sin transpilación
- **Sin dependencias externas** (el núcleo debe permanecer zero-deps)
- Usar WebCrypto API para toda operación criptográfica
- No agregar comentarios superfluos (explica el qué, no el cómo)
- Seguir indentación de 4 espacios
- Funciones asíncronas siempre con `async/await`, no Promesas raw
- Las propiedades internas (no parte de la API pública) deben empezar con `_`

## Testing

Actualmente no hay suite automatizada. Para contribuir:

1. Prueba manualmente el flujo completo:
   ```bash
   # Terminal 1: servidor
   node jamkernelp2p.js --port 9090 --room test --password 12345678 --log-level debug

   # Terminal 2: peer
   node -e "
   const {JAMOmni}=require('./jamkernelp2p.js');
   (async()=>{
     const k=await JAMOmni.createKernel({signalServer:'ws://localhost:9090'});
     const id=await k.whenIdentityReady();
     console.log('Peer:',id.peerId);
     k.events.on('mesh:peer_discovered',p=>console.log('Descubierto:',p));
     await k.startSession('test','12345678');
     await k.broadcast({text:'hola'});
   })()
   "
   ```

2. Si agregas funcionalidad, incluye en el PR cómo probarla

## Licencia y CLA

Al contribuir a jamkernelp2p, aceptas los siguientes términos:

1. **Dual License:** El proyecto se distribuye bajo GNU GPL v3 para uso open source, y bajo licencia comercial para uso propietario. Para mantener este modelo, todos los contribuyentes deben firmar un **Contributor License Agreement (CLA)** cediendo los derechos de autor de sus contribuciones a Félix Martínez.

2. **Proceso CLA:**
   - Lee y firma el [CLA.md](CLA.md)
   - Envía el CLA firmado a jamkernelp2p@gmail.com o adjúntalo a tu Pull Request
   - Sin CLA firmado, no podremos aceptar contribuciones

Sin el CLA firmado, el titular del proyecto no puede relicenciar tus contribuciones bajo la licencia comercial, lo que rompe el modelo de licenciamiento dual.
