# Mis Finanzas: prueba aislada de Face ID

Este entorno no forma parte de la aplicación financiera. No usa la base de datos, el almacenamiento local, la sesión ni la conexión bancaria de producción. No se deben introducir datos financieros reales.

## Preparación por el propietario

1. En GitHub Actions, seleccionar el workflow **Deploy isolated Face ID test Worker**, elegir la rama `feature/bbva-passkey-security` y ejecutarlo manualmente. El destino es exclusivamente `mis-finanzas-faceid-test`, no `mis-finanzas-bbva` ni `mis-finanzas-auth-staging`. Utiliza el secreto de GitHub `CLOUDFLARE_FACEID_TEST_TOKEN` (token individual con alcance exclusivo al Worker de pruebas) y `CLOUDFLARE_ACCOUNT_ID`. No sustituir el token anterior ni ampliar su alcance. El workflow fija el commit seleccionado y comprueba el nombre del destino antes del despliegue.
2. En Cloudflare, verificar que el Worker creado es `mis-finanzas-faceid-test` y que su URL coincide con `https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev`.
3. En los ajustes de **ese Worker**, configurar `PASSKEY_BOOTSTRAP_SECRET` como secreto de al menos 32 caracteres aleatorios. No usar una contraseña habitual, no subir el valor a GitHub, ni compartirlo por chat. Sin este secreto el acceso sigue deshabilitado. No eliminarlo mientras se quiera probar el login.
4. Abrir en Safari del iPhone `https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/face-id`. Si el dominio de Cloudflare no coincide, no introducir el secreto: corregir la configuración primero.

## Estado del entorno — 21/11/2026

- Despliegue de pruebas [#3](https://github.com/joseantonioaraujojimenez-cpu/mis-finanzas/actions/runs/44949250206): correcto; 35 comprobaciones automatizadas superadas.
- El propietario ha configurado el secreto de alta en Cloudflare; la pantalla de prueba carga y confirma que el servidor está habilitado.
- El propietario confirmó en Safari de su iPhone el registro de passkey, la entrada con Face ID, el cierre de sesión y la entrada posterior sin introducir la clave inicial. Las restantes comprobaciones físicas siguen pendientes.
- No se ha conectado BBVA ni se ha modificado la aplicación de producción.

## Prueba física

1. Introducir la clave de alta y pulsar **Registrar passkey**. Aceptar la hoja del iPhone y verificar que aparece la confirmación del registro.
2. Pulsar **Entrar con Face ID** y verificar que la sesión se activa. El sistema operativo puede usar el código del dispositivo como alternativa; WebAuthn exige verificación del usuario, no garantiza exclusivamente una modalidad biométrica.
3. Pulsar **Comprobar sesión**; debe indicar sesión activa.
4. Pulsar **Cerrar sesión**; después repetir el acceso. Cancelar el diálogo del sistema y confirmar que no aparece una sesión activa.
5. Repetir el acceso y dejar caducar la sesión 15 minutos; debe desaparecer la sesión activa. Recargar la página también elimina el token de la memoria del navegador.
6. Intentar registrar otra passkey: el alta única debe impedirlo. No repetir solicitudes innecesariamente, pues el sistema limita los intentos.

## Registro de aceptación (rellenar tras probar)

| Comprobación | Resultado |
|---|---|
| Registro inicial con el iPhone | Confirmado por el propietario |
| Acceso con verificación del dispositivo | Confirmado por el propietario (Face ID) |
| Consulta de sesión activa | Pendiente |
| Cierre de sesión | Confirmado por el propietario |
| Acceso posterior sin clave inicial | Confirmado por el propietario |
| Cancelación de Face ID sin acceso | Pendiente |
| Caducidad tras 15 minutos | Pendiente |
| Segunda alta rechazada | Pendiente |

Si hay un error, anotar el mensaje visible, versión de iOS, navegador y en qué paso ocurre. No adjuntar capturas con claves, códigos o tokens. Si Safari ofrece el código del dispositivo en lugar de Face ID, registrar ese comportamiento por separado.

## Límites antes de producción

No se ha habilitado la recuperación pública. Si se pierde el autenticador, detener la prueba y revisar un procedimiento seguro de recuperación antes de reiniciar el almacenamiento aislado. No migrar esta credencial a producción. La conexión a BBVA, el consentimiento bancario y el despliegue de la aplicación principal necesitan aprobación aparte.

Completar las comprobaciones físicas pendientes y una revisión de seguridad independiente siguen siendo requisitos antes de considerar la autenticación lista para producción. Los resultados de CI no equivalen a una auditoría completa.
