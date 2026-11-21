# Módulo experimental de passkeys

**No desplegar aún en producción ni conectar BBVA.** Código en revisión.

## Qué existe
- Endpoints para opciones y verificación de registro y autenticación WebAuthn.
- Comprobación de origen, RP ID y verificación de usuario.
- Credencial pública y sesiones efímeras en KV.
- No hay endpoints bancarios y no se modifica la web actual.

## Pendiente antes de desplegar
1. Sustituir KV por Durable Object para garantizar **consumo atómico** de challenges, actualización de contadores y registro único. KV tiene consistencia eventual y las operaciones get/delete no son atómicas; en su estado actual no debe proteger información bancaria.
2. Añadir limitación de intentos y protección contra ataques de fuerza bruta.
3. Crear secreto aleatorio `PASSKEY_BOOTSTRAP_SECRET` solo en Cloudflare (nunca en GitHub), y mecanismo de invalidación después del alta.
4. Sustituir `REPLACE_WITH_EXISTING_KV_NAMESPACE_ID` por el ID real del namespace de Cloudflare.
5. Implementar interfaz del iPhone con `@simplewebauthn/browser` y verificar funcionamiento en Safari/PWA.
6. Revisar almacenamiento de sesiones: token en memoria, no en localStorage; considerar cookies HttpOnly same-site y dominio propio para evitar problemas cross-site.
7. Comprobar compatibilidad de `@simplewebauthn/server` y ejecutar tests antes de despliegue.
8. Revisar documentación y condiciones reales de Enable Banking antes de conectar BBVA.
9. Auditar registro de logs, CORS, CSRF, recuperación de acceso y revocación de credenciales.

## Arquitectura
- App GitHub Pages: `https://joseantonioaraujojimenez-cpu.github.io/mis-finanzas/`
- Worker: `mis-finanzas-bbva` en Cloudflare.
- WebAuthn RP ID: `joseantonioaraujojimenez-cpu.github.io`
- Solo un propietario.
