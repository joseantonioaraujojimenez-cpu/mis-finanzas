# BBVA AIS — integración de pruebas

El flujo `worker/src/bbva-offline-flow.js` integra autorización, comprobación de sesión del proveedor, almacenamiento de consentimiento y consulta paginada. Solo se ejecuta con transporte inyectado y no está conectado a rutas públicas.

## Verificado con datos ficticios

- Sesión Face ID activa y `state` de un solo uso.
- Validación de consentimiento y cuenta autorizada antes de consultar.
- Lectura de saldos y movimientos contabilizados; deduplicación y clasificación.
- Cancelación de la entrega si se revoca la sesión durante una consulta.

## Pendiente antes de conectar una cuenta real

- Diseñar y probar la continuidad de la sesión del propietario tras la navegación de autorización. La sesión actual del navegador usa un token en memoria y no debe transferirse por URL ni almacenarse en almacenamiento web persistente.
- Cablear las operaciones internas del coordinador y validar la persistencia con Durable Objects en el entorno aislado.
- Verificar el estado y permisos AIS exclusivos de la aplicación del proveedor y el retorno HTTPS exacto.
- Obtener autorización expresa del propietario para la conexión real de solo lectura.
- Probar con el iPhone, registrar solo resultados no sensibles y verificar la desconexión/revocación con el proveedor.

No activar pagos o transferencias. No desplegar a producción ni introducir datos bancarios reales en las pruebas automatizadas.
