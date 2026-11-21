# Integración BBVA: requisitos de seguridad (en preparación)

Estado: **NO conectado a BBVA. No habilitar endpoints bancarios todavía.**

## Arquitectura
- Web pública: https://joseantonioaraujojimenez-cpu.github.io/mis-finanzas/
- Worker privado: Cloudflare Workers, con secretos `ENABLE_APP_ID`, `ENABLE_PRIVATE_KEY` y almacenamiento `AUTH_KV`.
- Datos financieros: almacenamiento local del iPhone; nunca publicar movimientos en GitHub.
- Banco: únicamente cuenta corriente BBVA; los cobros mensuales de tarjeta aplazada se contabilizan cuando salen de la cuenta.
- Acceso: un usuario, passkey WebAuthn usando Face ID en iPhone. Face ID autentica la passkey, no sustituye la verificación del servidor.

## Requisitos antes de habilitar la API bancaria
1. Registro inicial de passkey cerrado por defecto y autorizado mediante secreto de un solo uso; invalidarlo después del primer registro.
2. Verificación WebAuthn completa en el servidor: challenge aleatorio de un solo uso y caducidad corta, RP ID `joseantonioaraujojimenez-cpu.github.io`, origin exacto `https://joseantonioaraujojimenez-cpu.github.io`, tipo de operación, firma criptográfica, flags UV/UP, credential ID y contador según autenticador.
3. El registro y la autenticación se inician desde el origen de GitHub Pages; no se puede cambiar el RP ID arbitrariamente por estar el Worker en otro dominio.
4. Sesiones de corta duración, con tokens aleatorios validados por Worker y almacenados de forma segura. No incrustar `API_ACCESS_TOKEN` ni secretos en HTML, JavaScript público o localStorage.
5. CORS solo para el origen previsto; CORS no sustituye autenticación. Rechazar peticiones no autorizadas incluso sin cabecera Origin.
6. Protección CSRF y contra replay; rate limiting y revocación de sesiones; no registrar tokens, claves ni movimientos en logs.
7. Enable Banking: JWT RS256 firmado dentro del Worker. Solo endpoints de lectura; comprobar permisos, consentimiento y disponibilidad real de BBVA antes de activarlos.
8. El callback bancario se valida en servidor con state aleatorio de un solo uso; no incluir tokens bancarios en URL del frontend.
9. Pruebas: sin sesión -> 401; registro ajeno -> bloqueado; challenge reutilizado -> bloqueado; origen distinto -> bloqueado; passkey inválida -> bloqueado; acceso válido -> permitido.
10. Verificar las condiciones de gratuidad de Enable Banking y Cloudflare antes de conectar datos reales.

## Estado actual
La aplicación actual no tiene autenticación WebAuthn implementada. El Worker de prueba tiene un endpoint protegido por token, pero ese token no debe exponerse al navegador. Este documento es preparación, no una implementación terminada.
