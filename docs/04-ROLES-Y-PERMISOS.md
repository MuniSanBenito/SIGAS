# 04. Roles y permisos

## Principio general

SIGAS separa dos dimensiones:

- **Área:** pertenencia funcional para intervenciones futuras.
- **Rol:** capacidades operativas dentro del sistema.

Un usuario puede tener un rol transversal sin pertenecer a un área de intervención. Los permisos se evalúan en el backend y son iguales desde el frontend propio y Payload Admin.

## Roles iniciales

| Rol | Responsabilidad |
|---|---|
| **Administrador** | Acceso completo a usuarios, permisos, padrón, grupos, stock, entregas, auditoría e intervenciones. Puede operar desde Payload Admin. Todo acceso sensible queda auditado. |
| **Control de stock** | Gestiona productos, lotes, recetas, entradas, salidas y ajustes del depósito. No crea ni edita contribuyentes, grupos ni membresías. |
| **Administración** | Consulta y actualiza contribuyentes. Crea y mantiene grupos, referentes, integrantes y parentescos. No modifica stock ni entregas. |
| **Operador de Área** — futuro | Carga y consulta intervenciones propias del área asignada. Ve el semáforo resumido de otras áreas. |
| **Jefe de Área** — futuro | Administra las intervenciones propias de su área y reportes de equipo. |
| **Dirección/Supervisión** — futuro | Consulta coordinación y reportes. El acceso a detalle se define por área; el Administrador mantiene acceso completo. |
| **Consulta general** — opcional futuro | Consulta básica sin acceso a intervenciones, stock ni datos sensibles. |

## Asignación de roles en la primera implementación

Los roles iniciales se almacenan en un campo múltiple del usuario. Un usuario puede tener uno o más roles y recibe la unión de sus permisos. El Administrador los asigna y modifica desde Payload Admin; los usuarios operativos no pueden modificar sus propios roles.

Los valores iniciales son `admin`, `stock` y `administracion`. `admin` es el único rol habilitado para Payload Admin. El Administrador se protege como capacidad especial: no puede eliminarse ni quedar sin reemplazo.

## Roles y permisos configurables

La evolución prevista permite que el Administrador cree roles y permisos por módulo y acción. Deben existir controles de seguridad:

- proteger una capacidad de **superadministrador**;
- impedir eliminar o desactivar al último Administrador;
- auditar toda modificación de roles/permisos;
- no permitir que un usuario se otorgue permisos a sí mismo sin una operación autorizada;
- evaluar permisos en backend, no solo ocultando botones en el frontend;
- conservar el actor y la versión de permisos usada en acciones auditadas.

## Matriz del MVP

Convenciones: **V** = ver, **C** = crear/confirmar, **E** = editar/corregir, **B** = baja lógica, **–** = sin acceso.

| Módulo/acción | Administrador | Control de stock | Administración |
|---|---:|---:|---:|
| Usuarios, roles y permisos | V/C/E/B | – | – |
| Login y recuperación administrativa | V/C/E/B | V propia | V propia |
| Consulta de contribuyentes | V | – | V |
| Crear/editar contribuyentes | C/E/B | – | C/E/B |
| Crear/editar grupos y membresías | C/E/B | – | C/E/B |
| Cambiar referente | C/E/B | – | C/E/B |
| Historial de entregas | V | – | – |
| Productos y categorías | V/C/E/B | C/E/B | – |
| Lotes/vencimientos | V/C/E/B | C/E/B | – |
| Entradas de stock | V/C/E/B | C/E/B | – |
| Salidas por pérdida/vencimiento/ajuste | V/C/E/B | C/E/B | – |
| Recetas y versiones de bolsones | V/C/E/B | C/E/B | – |
| Confirmar entregas | V/C/E/B | – | – |
| Anular entregas confirmadas | V/C | – | – |
| Reportes de stock | V | V | – |
| Reportes de entregas | V | – | – |
| Auditoría | V | – | – |

En esta primera implementación solo se habilitan rutas y navegación para grupos familiares e inventario; las tarjetas informativas de Entregas y Reportes quedan visibles únicamente para el Administrador hasta construir sus pantallas y rutas.

Una entrega confirmada no se edita ni se borra. El Administrador la anula con motivo y crea una nueva. Ante faltante, el proceso autorizado ajusta las líneas reales y confirma solo lo disponible.

En el módulo de inventario, Control de stock y Administrador operan mediante comandos auditados. Los movimientos y saldos no se modifican desde el CRUD genérico. Una baja de producto es lógica: puede conservar saldo y permitir salidas, pero bloquea nuevas entradas y recetas. El control de lote/vencimiento queda fijo después del primer movimiento del producto.

## Permisos de contribuyentes

Administración y Administrador pueden editar todos los campos del contribuyente, incluyendo identidad y contacto. Esta capacidad es de alto riesgo y exige:

- DNI normalizado y validación de duplicados;
- identificador municipal estable para referencias internas, si existe;
- registro obligatorio de motivo;
- valores anteriores y nuevos;
- actor y timestamp;
- auditoría inmutable;
- permisos de base de datos mínimos y explícitos.

## Entregas y receptores

- Solo el Administrador puede confirmar o anular una entrega en esta primera matriz de roles.
- Administración y Control de stock no acceden al historial de entregas desde sus módulos.
- El destino puede ser un grupo o una persona.
- Una entrega individual sin grupo requiere autorización y motivo.
- Un retiro grupal corresponde a un integrante/referente o a un tercero que sea contribuyente y esté autorizado.
- El área de asistencia es opcional.

## Intervenciones futuras y privacidad

Las áreas solo gestionan el detalle de sus propias intervenciones. El semáforo común muestra únicamente:

- área;
- última fecha;
- cantidad de intervenciones.

No se muestran a otras áreas descripciones, fichas, adjuntos, nombres profesionales ni estados operativos.

El Administrador de SIGAS sí puede ver siempre el detalle y los adjuntos sensibles, incluyendo Mujer y Niñez. Cada acceso debe quedar auditado y esta decisión debe validarse con los protocolos municipales antes de liberar el módulo.

## Auditoría obligatoria

Se auditan como mínimo:

- login, bloqueo y restablecimiento de contraseña;
- creación, cambio y baja de usuarios, roles, permisos y áreas;
- alta y modificación de contribuyentes;
- creación y baja de grupos/membresías;
- entradas, salidas, ajustes y correcciones de stock;
- creación de recetas y versiones;
- confirmación, corrección o reversión de entregas;
- acceso del Administrador a intervenciones sensibles.

La auditoría no guarda contraseñas ni secretos y no puede editarse desde la aplicación.
