# Integración bancaria: fase de simulación

El Worker de pruebas permite ensayar clasificación automática, importación de movimientos de ejemplo, deduplicación e importes en céntimos. No se conecta a BBVA ni a Enable Banking. No utiliza credenciales bancarias ni persiste movimientos reales.

La fase de consentimiento simulado permite al propietario conceder acceso de solo lectura durante 30 minutos, sincronizar exclusivamente los ejemplos y revocar el permiso. El estado de consentimiento se mantiene en el almacenamiento aislado y cada operación verifica de forma transaccional la sesión de la aplicación. El panel conserva su muestra ficticia incluso sin consentimiento, pero las acciones de sincronización requieren el permiso simulado. No es un consentimiento bancario legal ni activa ninguna integración externa.

## Fase autorizada: preparación del proveedor, sin conexión real

El propietario autorizó preparar la consulta de saldos y movimientos de BBVA por Enable Banking. El módulo `worker/src/enable-banking-contract.js` describe las peticiones permitidas (autorización de cuenta, intercambio de código, estado y revocación de consentimiento, lecturas de saldo y movimientos); no contiene un transporte de red y no se importa desde el Worker desplegado. El callback indicado es una ruta prevista, aún no publicada. Las pruebas usan identificadores ficticios. No existe ninguna operación de pagos.

El propietario ha creado una aplicación Sandbox y ha configurado sus dos secretos exclusivos en el Worker de pruebas. El nuevo botón de diagnóstico valida, mediante peticiones de metadatos, el entorno SANDBOX, el servicio AIS, el callback registrado y la presencia de BBVA España. No inicia autorización ni consulta cuentas. La integración real y cualquier dato financiero permanecen desconectados hasta completar el consentimiento oficial, revisar el tratamiento y almacenamiento de datos y probar el sandbox. No introducir credenciales bancarias o claves privadas en el chat ni en GitHub.

## Lista de control antes de activar una conexión real

- Verificar el proveedor de acceso a cuentas y sus condiciones, disponibilidad de BBVA España y permisos de solo lectura.
- Solicitar consentimiento al titular mediante el flujo oficial de autorización del proveedor. No pedir credenciales bancarias a través de MIS FINANZAS.
- Mantener la autenticación de la aplicación separada del consentimiento bancario. Guardar los secretos del proveedor únicamente en almacenamiento seguro del servidor.
- Determinar expiración, revocación, reconsentimiento, límites de acceso, manejo de errores y protección de los datos antes de incorporar movimientos reales.
- Crear almacenamiento segregado del lado servidor con control de acceso. No reutilizar los datos locales existentes ni migrarlos sin una copia de seguridad y autorización.
- Validar con datos de prueba antes de activar cualquier acceso real. El entorno aislado seguirá desconectado por defecto.

Referencia oficial: https://enablebanking.com/docs/api/reference/
