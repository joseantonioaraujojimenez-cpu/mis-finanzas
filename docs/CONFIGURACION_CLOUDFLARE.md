# Preparación de Cloudflare — Mis Finanzas

**Estado: preparación documental. No se ha conectado ni desplegado nada.** La web actual no debe modificarse.

## Qué existe en la rama de desarrollo
- Worker de pruebas: `mis-finanzas-auth-staging` (configurado en `worker/wrangler.jsonc`). El Worker existente `mis-finanzas-bbva` es producción y no debe sobrescribirse.
- Almacenamiento de autenticación: Durable Object SQLite `PasskeyCoordinator`.
- Único secreto previsto para el alta inicial: `PASSKEY_BOOTSTRAP_SECRET`.
- Las rutas de registro e inicio de sesión continúan respondiendo HTTP 503 intencionadamente.
- No hay conexión BBVA, Enable Banking, consulta de cuentas ni movimientos.

## Preparación manual, cuando el propietario esté delante de Cloudflare
1. Entrar en el panel de Cloudflare con la cuenta propietaria y comprobar que el proyecto/Worker pertenece a esa cuenta.
2. Revisar el nombre del Worker, la compatibilidad y la migración SQLite de `PasskeyCoordinator`. No cambiar el Worker de producción de la web.
3. Antes de configurar secretos, confirmar que el repositorio y la rama son los esperados y que el despliegue automático está desactivado.
4. Crear un secreto de alta inicial largo y aleatorio fuera del chat. No reutilizar contraseñas. No pegarlo en GitHub, archivos, capturas ni conversaciones.
5. Guardarlo como secreto del Worker mediante el panel de Cloudflare o el comando interactivo `npx wrangler secret put PASSKEY_BOOTSTRAP_SECRET` ejecutado desde `worker/`. No incluir el valor en la línea de comandos ni en el historial.
6. No ejecutar `wrangler deploy` todavía. Primero revisar los ajustes, el estado de la cuenta y la lista de secretos sin revelar sus valores.
7. Mantener el bloqueo 503 hasta que se haya completado una revisión independiente del flujo de registro, login, recuperación, rate limits, sesiones y protección del secreto inicial.

## Pruebas permitidas antes de habilitar autenticación
- `npm test` y el workflow de GitHub Actions.
- `wrangler deploy --dry-run` para compilar sin publicar.
- `wrangler dev --local` para smoke tests locales.
- No introducir el secreto real en las pruebas locales o en CI.

## Condiciones que siguen pendientes
- Verificación de Face ID/WebAuthn en Safari de un iPhone real.
- Revisión independiente de seguridad del código y del despliegue.
- Confirmación de que la passkey de respaldo/recuperación funciona y no permite saltarse la verificación criptográfica.
- Política y procedimiento de revocación.
- Integración bancaria y consentimiento BBVA: fase posterior, separada y todavía no autorizada.

**Regla de seguridad:** no compartir claves ni códigos de recuperación por ChatGPT. Si se necesita introducir un secreto, hacerlo directamente en el panel de Cloudflare o en un terminal local de confianza.
