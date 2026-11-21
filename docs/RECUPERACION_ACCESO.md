# Recuperación de acceso: decisión pendiente

## Estado
El acceso con passkey/Face ID está **desactivado**. Solo se contempla un propietario y una credencial. No existe un mecanismo de recuperación implementado ni auditado.

## Riesgo
Si el propietario pierde el dispositivo o deja de tener disponible la passkey, no podrá acceder. Una passkey sincronizada con Llavero de iCloud puede seguir disponible en otros dispositivos del mismo ecosistema, pero **no debe darse por garantizado**. Face ID es un mecanismo local de verificación del usuario; el servidor valida la passkey, no recibe datos biométricos.

## Alternativas a decidir antes de activar
1. **Segunda passkey de respaldo** en otro dispositivo controlado por el propietario, con alta solo después de autenticación fuerte y confirmación adicional. Requiere modificar la restricción actual de credencial única y revisar la lógica de contadores y revocación.
2. **Código de recuperación de un solo uso**, generado en el servidor, mostrado una única vez y guardado fuera del dispositivo. Almacenar solo su hash, limitar intentos, exigir rotación y revocar sesiones al recuperarse.
3. **Recuperación manual asistida** con verificación independiente. No implementada; no improvisar un endpoint de reinicio ni confiar únicamente en correo electrónico.

## Reglas mínimas
- Nunca ofrecer un endpoint público que borre o reemplace la credencial solo con el secreto de alta inicial.
- El secreto de alta inicial deja de servir después de registrar el primer dispositivo.
- Toda recuperación debe revocar sesiones existentes, dejar rastro de auditoría sin datos sensibles y exigir un nuevo registro WebAuthn.
- No almacenar códigos ni secretos de recuperación en GitHub Pages, localStorage, registros o repositorio.
- No activar autenticación hasta elegir e implementar un procedimiento de recuperación y probarlo en un dispositivo real.

## Pendiente de confirmación del propietario
Elegir el método de respaldo adecuado para su uso con iPhone. Esta decisión debe tomarse antes de habilitar el registro de Face ID.
