# Mis Finanzas: prueba aislada de Face ID

Este entorno no forma parte de la aplicación financiera. No usa la base de datos, el almacenamiento local, la sesión ni la conexión bancaria de producción. No se deben introducir datos financieros reales.

## Preparación por el propietario

1. En GitHub Actions, seleccionar el workflow **Deploy isolated Face ID test Worker**, elegir la rama `feature/bbva-passkey-security` y ejecutarlo manualmente. El destino es exclusivamente `mis-finanzas-faceid-test`, no `mis-finanzas-bbva` ni `mis-finanzas-auth-staging`. Requiere las credenciales de despliegue Cloudflare ya configuradas en GitHub; si faltan, no improvisar nuevas credenciales.
2. En Cloudflare, verificar que el Worker creado es `mis-finanzas-faceid-test` y que su URL coincide con `https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev`.
3. En los ajustes de **ese Worker**, configurar `PASSKEY_BOOTSTRAP_SECRET` como secreto de al menos 32 caracteres aleatorios. No usar una contraseña habitual, no subir el valor a GitHub, ni compartirlo por chat. Sin este secreto el acceso sigue deshabilitado. No eliminarlo mientras se quiera probar el login.
4. Abrir en Safari del iPhone `https://mis-finanzas-faceid-test.joseantonioaraujojimenez.workers.dev/face-id`. Si el dominio de Cloudflare no coincide, no introducir el secreto: corregir la configuración primero.

## Prueba física

1. Introducir la clave de alta y pulsar **Registrar passkey**. Aceptar la hoja del iPhone y verificar que aparece la confirmación del registro.
2. Pulsar **Entrar con Face ID** y verificar que la sesión se activa. El sistema operativo puede usar el código del dispositivo como alternativa; WebAuthn exige verificación del usuario, no garantiza exclusivamente una modalidad biométrica.
3. Pulsar **Comprobar sesión**; debe indicar sesión activa.
4. Pulsar **Cerrar sesión**; después repetir el acceso. Cancelar el diálogo del sistema y confirmar que no aparece una sesión activa.
5. Repetir el acceso y dejar caducar la sesión 15 minutos; debe desaparecer la sesión activa. Recargar la página también elimina el token de la memoria del navegador.
6. Intentar registrar otra passkey: el alta única debe impedirlo. No repetir solicitudes innecesariamente, pues el sistema limita los intentos.

## Límites antes de producción

No se ha habilitado la recuperación pública. Si se pierde el autenticador, detener la prueba y revisar un procedimiento seguro de recuperación antes de reiniciar el almacenamiento aislado. No migrar esta credencial a producción. La conexión a BBVA, el consentimiento bancario y el despliegue de la aplicación principal necesitan aprobación aparte.

La prueba real de Safari/iPhone y una revisión de seguridad independiente siguen siendo requisitos antes de considerar la autenticación lista para producción. Los resultados de CI no equivalen a una auditoría completa.
