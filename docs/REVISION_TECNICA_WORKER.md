# Revisión técnica preliminar del Worker

Fecha: 2026-11-21  
Estado: **REVISIÓN PRELIMINAR; NO ES UNA AUDITORÍA DE SEGURIDAD INDEPENDIENTE.**

## Alcance revisado
- `worker/src/index.js`
- `worker/src/passkey-coordinator.js`
- `worker/src/recovery-code.js`
- `worker/src/recovery-webauthn.js`
- `worker/src/recovery-flow.js`
- `passkey-test.html`
- `worker/wrangler.jsonc`
- Workflow de GitHub Actions y pruebas de integración locales.

## Controles observados en el código
- Las rutas de alta e inicio de sesión devuelven HTTP 503 antes de cualquier operación de autenticación.
- La raíz informa `bank_connected:false`; no hay rutas públicas de cuentas o movimientos.
- El Worker limita el origen CORS al GitHub Pages previsto, valida el tipo de contenido y limita el cuerpo JSON.
- La credencial se almacena en Durable Object; los desafíos se consumen transaccionalmente una sola vez.
- El registro es first-writer-wins y las sesiones tienen expiración y revocación por época.
- El código de recuperación tiene 256 bits de aleatoriedad y solo se persiste su digest.
- Las funciones de recuperación no están conectadas a rutas públicas.
- La página experimental mantiene el token de sesión en memoria y no persiste el token en localStorage.
- Los workflows realizan pruebas, compilación dry-run y smoke tests locales; no despliegan.

## Pendientes antes de cualquier despliegue o activación
1. Revisión independiente del diseño y de la implementación WebAuthn completa, incluida la carrera de actualización del contador y el manejo de credenciales sincronizadas que pueden devolver contador cero.
2. Definir y probar el procedimiento de creación, entrega, uso único y revocación del código de recuperación. Actualmente existen primitivas internas, no un flujo de usuario completo.
3. Verificar en iPhone Safari el registro y la autenticación reales, incluyendo cancelación, caducidad, reintentos y segundo dispositivo.
4. Confirmar que el secreto de alta inicial se invalida después del primer registro. El código actual comprueba que ya exista una credencial, pero no implementa todavía una operación de borrado/rotación del secreto en Cloudflare.
5. Revisar protección frente a XSS y el almacenamiento del token en el contexto del navegador; memoria evita persistencia, pero no protege frente a un script malicioso ejecutándose en la página.
6. Comprobar el plan y coste de Cloudflare Durable Objects SQLite, las migraciones y las políticas de backup/retención.
7. Realizar pruebas de abuso y revisión de dependencias; las pruebas automatizadas no sustituyen una auditoría.
8. Solo después de todo lo anterior, decidir por separado si se habilita autenticación. La conexión BBVA requiere una revisión y autorización posterior.

## Aislamiento de despliegue
La configuración Wrangler usa el nombre `mis-finanzas-auth-staging`, distinto del Worker de producción existente `mis-finanzas-bbva`. Esta separación evita que un despliegue accidental desde esta rama sustituya el Worker actual. Antes de cualquier publicación, verificar también la cuenta Cloudflare y que no existan rutas/custom domains asociados al Worker de staging.

## Decisión actual
**No desplegar, no fusionar a main y no activar Face ID ni BBVA.** Mantener el bloqueo 503 y la aplicación pública actual sin cambios hasta completar los puntos anteriores.
