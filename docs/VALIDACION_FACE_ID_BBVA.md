# Validación previa a activar Face ID y BBVA

Estado: **NO APTO PARA PRODUCCIÓN**. Las pruebas automáticas locales han pasado, pero no prueban el registro WebAuthn en un iPhone real ni autorizan un despliegue.

## 1. Prueba real de Face ID (pendiente)
- Probar en iPhone con Safari, HTTPS y Face ID activado.
- Registrar una única credencial con un secreto de alta **nuevo**, introducido directamente en la página de pruebas; no compartirlo en chats ni subirlo a GitHub.
- Confirmar que una segunda alta queda rechazada.
- Confirmar que la autenticación exige verificación del usuario y que cancelar Face ID no crea sesión.
- Confirmar que el reto WebAuthn no se puede reutilizar y que un reto caducado falla.
- Confirmar que cerrar sesión revoca el token y que expira a los 15 minutos.
- Confirmar que un origen distinto del GitHub Pages autorizado queda rechazado.
- Probar Safari en segundo plano, recarga, conexión interrumpida y cancelación.

## 2. Revisión de seguridad (pendiente)
- Revisar la validación completa de WebAuthn (challenge, RP ID, origin, user verification y contador).
- Revisar la carrera entre verificación del autenticador y actualización del contador.
- Revisar el control de alta inicial y el procedimiento de recuperación si se pierde el iPhone.
- Establecer una política de rotación de secretos y revocación de sesiones.
- Limitar el alcance de los tokens a endpoints concretos; nunca exponer claves Enable Banking al navegador.
- Revisar dependencias, cabeceras, CORS, tamaño de peticiones y registros sin datos sensibles.
- Mantener el bloqueo 503 hasta terminar la revisión y la prueba real.

## 3. BBVA / Enable Banking (pendiente)
- Verificar disponibilidad y condiciones de la API para la cuenta corriente del usuario.
- Diseñar y probar OAuth/consentimiento con estado anti-CSRF, expiración y renovación.
- Almacenar las credenciales y tokens bancarios solo en el backend.
- No activar consultas de saldo ni movimientos sin consentimiento explícito.
- Comprobar límites, caducidad del consentimiento y desconexión/revocación.

## 4. Despliegue
- La rama de desarrollo y la PR son para revisión: no fusionar ni desplegar el Worker de autenticación antes de completar los puntos anteriores.
- La aplicación pública actual y su almacenamiento local no deben alterarse durante estas pruebas.
- La página experimental no debe mostrar ni almacenar secretos, datos bancarios ni tokens persistentes.

**Resultado actual:** pruebas unitarias y de integración locales correctas; dispositivo real, revisión de seguridad y conexión BBVA pendientes.
