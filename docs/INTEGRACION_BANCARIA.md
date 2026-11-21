# Integración bancaria: fase de simulación

El Worker de pruebas permite ensayar clasificación automática, importación de movimientos de ejemplo, deduplicación e importes en céntimos. No se conecta a BBVA ni a Enable Banking. No utiliza credenciales bancarias ni persiste movimientos reales.

## Fase siguiente (requiere autorización explícita)

- Verificar el proveedor de acceso a cuentas y sus condiciones, disponibilidad de BBVA España y permisos de solo lectura.
- Solicitar consentimiento al titular mediante el flujo oficial de autorización del proveedor. No pedir credenciales bancarias a través de MIS FINANZAS.
- Mantener la autenticación de la aplicación separada del consentimiento bancario. Guardar los secretos del proveedor únicamente en almacenamiento seguro del servidor.
- Determinar expiración, revocación, reconsentimiento, límites de acceso, manejo de errores y protección de los datos antes de incorporar movimientos reales.
- Crear almacenamiento segregado del lado servidor con control de acceso. No reutilizar los datos locales existentes ni migrarlos sin una copia de seguridad y autorización.
- Validar con datos de prueba antes de activar cualquier acceso real. El entorno aislado seguirá desconectado por defecto.

Referencia oficial: https://enablebanking.com/docs/api/reference/
