# 08. Contrato del padrón municipal

## Estado

**Cerrado para el primer flujo (Gate 0) con supuestos de avance.**  
Pendiente de validación formal con Infraestructura antes de conectar el padrón real.

Este documento define la información técnica mínima que SIGAS necesita para conectarse al padrón en vivo. No se deben pegar aquí contraseñas, tokens, datos personales reales ni cadenas de conexión completas.

## Objetivo

Permitir que SIGAS consulte, cree y actualice contribuyentes en la base municipal sin duplicar el padrón en MongoDB.

## Decisión de avance para el primer flujo

Para no bloquear el arranque, el primer corte usará un **adaptador de padrón con implementación mock**. El contrato de dominio queda fijo; el motor real se conecta después sin cambiar grupos, entregas ni auditoría.

Supuestos adoptados:

| Tema | Decisión de avance |
|---|---|
| Fuente oficial | La base municipal sigue siendo dueña de los contribuyentes. |
| Duplicación | SIGAS no guarda una copia local permanente del padrón en Mongo. |
| Referencia técnica | Se usará `contribuyente_id` estable. Si Infraestructura no tiene uno, el adaptador real deberá mapearlo o se aprobará una alternativa. |
| Búsqueda principal | DNI normalizado. CUIT es alias opcional. |
| Escritura | El adaptador soporta alta y actualización; el mock las confirma en memoria de prueba. |
| Caída del padrón | Se bloquean operaciones que dependan de contribuyentes. No se usa caché ni carga provisoria. |
| Resultado de integración | `solicitada`, `confirmada`, `rechazada` o `incierta`. |
| Operación incierta | No se reintenta automáticamente sin idempotencia o verificación posterior. |

`solicitada` representa el inicio de la operación. El adaptador conserva la secuencia hasta un estado terminal (`confirmada`, `rechazada` o `incierta`); el mock devuelve el estado terminal junto con el historial del ciclo.

## Datos técnicos a relevar con Infraestructura

### Motor y conexión

- Motor: `pendiente`
- Versión: `pendiente`
- Ambiente de prueba disponible: `pendiente`
- Ambiente de producción: `pendiente`
- ¿La base está en red municipal, VPS, nube u otro entorno?: `pendiente`
- Mecanismo seguro de conexión: `pendiente`
- ¿La conexión usa TLS/cifrado?: `pendiente`
- Latencia aproximada desde el VPS: `pendiente`

### Estructura del padrón

- Tabla o vista de contribuyentes: `pendiente`
- Clave primaria o identificador interno: `pendiente — se asume ID estable para el diseño`
- ¿La clave es inmutable ante correcciones de DNI, nombre o domicilio?: `pendiente`
- Campo DNI: `pendiente`
- Campo CUIT: `pendiente`
- Campos de nombre/apellido: `pendiente`
- Campo fecha de nacimiento: `pendiente`
- Campos de teléfono/dirección/barrio: `pendiente`
- Campo de estado activo/inactivo: `pendiente`
- Última actualización o timestamp disponible: `pendiente`

### Contrato de lectura

El primer flujo implementará:

- [x] buscar por identificador municipal;
- [x] buscar por DNI normalizado;
- [x] buscar por CUIT;
- [x] buscar por nombre/apellido;
- [x] obtener dirección y barrio;
- [x] consultar estado activo/inactivo;
- [ ] consultar cambios desde una fecha o timestamp — fase posterior.

### Contrato de escritura

El primer flujo implementará en el adaptador:

- [x] crear contribuyentes;
- [x] actualizar todos los campos definidos;
- [ ] actualizar solo campos autorizados — no aplica: se confirmó edición completa;
- [x] corregir DNI/CUIT;
- [x] desactivar contribuyentes;
- [x] validar duplicados;
- [x] obtener el ID creado después de un alta;
- [x] usar una clave de idempotencia o referencia externa.

### Permisos y seguridad

- Usuario técnico separado del usuario humano: `sí, requerido`
- Permiso de solo lectura disponible: `sí, requerido para pruebas`
- Permiso de escritura limitado a tablas/campos: `sí, requerido`
- Lista de IPs permitidas: `pendiente`
- Rotación de credenciales: `pendiente`
- Responsable de otorgar/revocar acceso: `pendiente`
- Logs de acceso disponibles: `pendiente`

## Casos de error

| Caso | Respuesta esperada | Responsable |
|---|---|---|
| DNI/CUIT duplicado | `rechazada` | Adaptador / padrón |
| Contribuyente inexistente | `rechazada` | Adaptador / padrón |
| Base no disponible | `incierta` o indisponibilidad visible; se bloquean destinatarios | SIGAS |
| Timeout durante escritura | `incierta`; no se reintenta sin verificación | SIGAS |
| Respuesta incompleta | `incierta` | SIGAS |
| Escritura aplicada pero respuesta perdida | `incierta`; verificación posterior | SIGAS |
| Permiso insuficiente | `rechazada` | Infraestructura |

## Evidencia pendiente para el adaptador real

- [ ] Esquema sanitizado o documentación equivalente.
- [ ] Confirmación del ID estable o decisión formal sobre alternativa.
- [ ] Usuario técnico y permisos mínimos aprobados.
- [ ] Conectividad segura probada desde el entorno de prueba.
- [ ] Prueba de lectura exitosa.
- [ ] Prueba de escritura controlada en ambiente no productivo.
- [ ] Procedimiento ante timeout, caída y resultado incierto.
- [ ] Responsable de aprobación identificado.

**No incluir secretos ni registros de contribuyentes reales en este documento.**
