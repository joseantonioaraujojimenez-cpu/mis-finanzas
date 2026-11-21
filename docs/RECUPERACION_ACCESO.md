# Recuperación de acceso: decisión pendiente

## Estado
El acceso con passkey/Face ID está **desactivado**. Solo se contempla un propietario y una credencial. No existe un mecanismo de recuperación implementado ni auditado.

## Riesgo
Si el propietario pierde el dispositivo o deja de tener disponible la passkey, no podrá acceder. Una passkey sincronizada con Llavero de iCloud puede seguir disponible en otros dispositivos del mismo ecosistema, pero **no debe darse por garantizado**. Face ID es un mecanismo local de verificación del usuario; el servidor valida la passkey, no recibe datos biométricos.

## Decisión del propietario (21/11/2026)
Se elige **código de recuperación de un solo uso**, guardado fuera del iPhone. Pendiente de implementación, auditoría y pruebas. La elección no autoriza activar Face ID ni conectar BBVA.

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

