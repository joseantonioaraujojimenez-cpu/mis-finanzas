# Recuperación de acceso: diseño de seguridad

## Estado
El acceso con passkey/Face ID está **desactivado**. Solo se contempla un propietario y una credencial. Existen utilidades internas de generación de códigos y almacenamiento de huellas, pero **no existe un flujo público de recuperación completo ni auditado**.

## Riesgo
Si el propietario pierde el dispositivo o deja de tener disponible la passkey, no podrá acceder. Una passkey sincronizada con Llavero de iCloud puede seguir disponible en otros dispositivos del mismo ecosistema, pero **no debe darse por garantizado**. Face ID es un mecanismo local de verificación del usuario; el servidor valida la passkey, no recibe datos biométricos.

## Decisión del propietario (21/11/2026)
Se elige **código de recuperación de un solo uso**, guardado fuera del iPhone. Implementación parcial; pendiente de integración segura, auditoría y pruebas con iPhone. La elección no autoriza activar Face ID ni conectar BBVA.

## Alternativas consideradas antes de activar
1. **Segunda passkey de respaldo** en otro dispositivo controlado por el propietario, con alta solo después de autenticación fuerte y confirmación adicional. Requiere modificar la restricción actual de credencial única y revisar la lógica de contadores y revocación.
2. **Código de recuperación de un solo uso**, generado en el servidor, mostrado una única vez y guardado fuera del dispositivo. Almacenar solo su hash, limitar intentos, exigir rotación y revocar sesiones al recuperarse.
3. **Recuperación manual asistida** con verificación independiente. No implementada; no improvisar un endpoint de reinicio ni confiar únicamente en correo electrónico.

## Reglas mínimas
- Nunca ofrecer un endpoint público que borre o reemplace la credencial solo con el secreto de alta inicial.
- El secreto de alta inicial deja de servir después de registrar el primer dispositivo.
- Toda recuperación debe revocar sesiones existentes, dejar rastro de auditoría sin datos sensibles y exigir un nuevo registro WebAuthn.
- No almacenar códigos ni secretos de recuperación en GitHub Pages, localStorage, registros o repositorio.
- No activar autenticación hasta elegir e implementar un procedimiento de recuperación y probarlo en un dispositivo real.

## Plan de implementación del código de recuperación
1. Emitir el código solo desde una sesión WebAuthn autenticada y reciente; mostrarlo una vez y no registrarlo en logs.
2. Generar al menos 256 bits aleatorios con Web Crypto; guardar únicamente un digest criptográfico con separación de dominio en Durable Object.
3. Comprobarlo con comparación segura, límite de intentos y consumo atómico en una transacción. Nunca devolver el hash al navegador.
4. Durante la recuperación, revocar todas las sesiones y reemplazar la credencial solo tras completar una nueva verificación WebAuthn, con flujo de recuperación limitado en tiempo y de un solo uso.
5. Probar pérdida de dispositivo, reintentos, concurrencia, reutilización, expiración, cancelación y fallo de red.
6. Mantener los endpoints de recuperación desactivados hasta que el flujo completo esté implementado, auditado y probado en iPhone.


## Estado técnico a 21/11/2026
- `worker/src/recovery-code.js` genera 256 bits aleatorios con Web Crypto y calcula un digest SHA-256 con separación de dominio; el código se presenta en ocho bloques hexadecimales.
- El Durable Object conserva únicamente el digest, impide sobrescribirlo y limita a cinco intentos por ventana de quince minutos, con operaciones transaccionales.
- **La recuperación NO está habilitada ni expuesta en rutas públicas.** La autenticación con passkey sigue desactivada.

## Riesgo pendiente: no consumir antes de confirmar el reemplazo
La operación interna actual `/recovery/consume` elimina el digest al validarlo. **No debe llamarse desde un endpoint público de recuperación**: un corte de red o un fallo al registrar el nuevo dispositivo después de consumirlo bloquearía la recuperación. Antes de habilitar el flujo, sustituirla por una operación atómica que valide el código, emita una autorización efímera de recuperación de un solo uso y **complete en una única transacción** la sustitución de la credencial, revocación de todas las sesiones y anulación del código tras verificar el registro WebAuthn. El código debe permanecer protegido contra carreras y reintentos, y la autorización efímera debe caducar.

## Pruebas de aceptación obligatorias
- Código erróneo, agotamiento de intentos y concurrencia de verificaciones.
- Registro WebAuthn fallido o cancelado: sin sustitución de la credencial ni pérdida irreversible del código.
- Registro exitoso: sustitución única, código invalidado y todas las sesiones previas revocadas.
- Reintento o carrera de finalización: como máximo un nuevo dispositivo autorizado.
- Recuperación en iPhone real y revisión de las restricciones del dominio GitHub Pages.
