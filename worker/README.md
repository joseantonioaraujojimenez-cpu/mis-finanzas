# Módulo experimental de Face ID (WebAuthn)

**NO desplegar ni conectar BBVA todavía.** El acceso permanece bloqueado por una respuesta HTTP 503 intencional hasta completar pruebas de integración, auditoría y alta segura.

## Implementado en rama de desarrollo
- WebAuthn con origen GitHub Pages y RP ID fijados.
- Durable Object para desafíos de un solo uso, alta única, contadores y sesiones de 15 minutos.
- Límites de intentos en registro y acceso, tanto al solicitar opciones como al verificar.
- Cierre de sesión con revocación del token; creación y validación de sesiones coordinadas transaccionalmente con la revocación global.
- Recuperación interna en dos fases: código de recuperación, ticket temporal y nuevo desafío WebAuthn. Solo se permite sustituir la credencial tras consumir el desafío y verificar criptográficamente el registro; el reemplazo revoca las sesiones previas.
- La operación antigua que consumía el código sin sustituir la credencial se ha eliminado. La recuperación no está disponible desde rutas públicas.
- Pantalla experimental para registro, acceso, estado y cierre.
- GitHub Actions: pruebas estáticas, compilación y smoke tests HTTP locales.
- Ningún endpoint bancario habilitado. La web principal no se ha modificado.

## Pendiente antes de permitir el alta real
1. Pruebas funcionales WebAuthn con un navegador y un autenticador real (iPhone Safari/PWA).
2. Revisar exhaustivamente el límite de intentos, las carreras de contadores y los mecanismos de recuperación.
3. Configurar el secreto de alta inicial exclusivamente en Cloudflare; comprobar su invalidación tras el registro.
4. Revisar protección CSRF, exposición de tokens, logs, cabeceras y recuperación de credenciales.
5. Revisar el contrato y el consentimiento de Enable Banking antes de cualquier conexión bancaria.
6. Validar costes y compatibilidad del Durable Object en la cuenta de Cloudflare.
7. Desplegar únicamente después de revisar y retirar explícitamente el bloqueo preventivo.

## Arquitectura
- App: https://joseantonioaraujojimenez-cpu.github.io/mis-finanzas/
- Worker de pruebas: mis-finanzas-auth-staging. El Worker existente mis-finanzas-bbva se mantiene separado y no debe sustituirse.
- RP ID: joseantonioaraujojimenez-cpu.github.io.
- Un propietario; secretos nunca en GitHub ni en la app pública.
