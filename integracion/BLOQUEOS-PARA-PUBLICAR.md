# Bloqueos de integración BBVA — 22/11/2026

**Estado: NO desplegar ni fusionar todavía.**

## 1. Origen distinto (bloqueo confirmado por inspección del Worker suministrado)
El Worker candidato que se ha utilizado como referencia calcula `allowedOrigin` como `TEST_ORIGIN` cuando `FACEID_TEST_MODE=enabled`, y para `/bank/accounts` y `/bank/transactions` comprueba `origin !== allowedOrigin`, devolviendo 403. La aplicación web alojada en otro dominio no puede llamar a estas rutas. El preflight OPTIONS también devuelve 403.

**Solución preferente:** servir la interfaz de Mis Finanzas desde el mismo origen del Worker, con su flujo de Face ID. Alternativa: introducir una lista de orígenes explícita, verificada, y adaptar CORS, CSP y la vinculación de sesión. No usar `Access-Control-Allow-Origin: *` con sesiones financieras.

## 2. Sesión Face ID
`MisFinanzasVincularSesion(token)` es un punto de acoplamiento aún NO conectado al login real. No obtener tokens desde URL, fragmentos, localStorage, formularios o repositorio. La integración debe producirse dentro del mismo origen y flujo de autenticación.

## 3. Consultas innecesarias
En el Worker candidato `/bank/accounts` solicita `/accounts/{id}/balances` para cada cuenta, lo que genera peticiones bancarias aunque solo se quieran listar cuentas. Se debe devolver primero la lista de identificadores autorizados desde el almacenamiento de sesión, sin consultar saldos. El histórico debe usar primero caché y consultar el banco solo por acción explícita del usuario, con control de frecuencia.

## 4. Alcance y pruebas
El archivo `index.js.txt` original no contiene todos los endpoints bancarios del Worker candidato. No hay prueba de que el candidato coincida con la versión desplegada. Antes de sustituir producción, confirmar el contrato de autenticación y el almacenamiento de sesiones en un entorno de pruebas, y realizar una copia de la configuración y del Worker publicado.

**Importante:** las pruebas unitarias simuladas no validan CORS, Face ID real, Enable Banking ni persistencia del servidor.
