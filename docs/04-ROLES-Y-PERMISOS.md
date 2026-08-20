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
| **Depósito/Stock** | Gestiona productos, lotes, recetas, entradas, salidas y confirmación de entregas. Consulta grupos. Puede corregir cualquier campo de contribuyente, con auditoría, pero no modifica miembros, referentes ni estructura de grupos. |
| **Gestión de grupos** | Consulta y actualiza contribuyentes. Crea y mantiene grupos, referentes, integrantes y parentescos. Consulta historial de entregas, pero no crea, edita, corrige ni anula entregas ni stock. |
| **Operador de Área** — futuro | Carga y consulta intervenciones propias del área asignada. Ve el semáforo resumido de otras áreas. |
| **Jefe de Área** — futuro | Administra las intervenciones propias de su área y reportes de equipo. |
| **Dirección/Supervisión** — futuro | Consulta coordinación y reportes. El acceso a detalle se define por área; el Administrador mantiene acceso completo. |
| **Consulta general** — opcional futuro | Consulta básica sin acceso a intervenciones, stock ni datos sensibles. |

## Roles y permisos configurables

El Administrador puede crear roles y permisos por módulo y acción. Deben existir controles de seguridad:

- proteger una capacidad de **superadministrador**;
- impedir eliminar o desactivar al último Administrador;
- auditar toda modificación de roles/permisos;
- no permitir que un usuario se otorgue permisos a sí mismo sin una operación autorizada;
- evaluar permisos en backend, no solo ocultando botones en el frontend;
- conservar el actor y la versión de permisos usada en acciones auditadas.

## Matriz del MVP

Convenciones: **V** = ver, **C** = crear/confirmar, **E** = editar/corregir, **B** = baja lógica, **–** = sin acceso.

| Módulo/acción | Administrador | Depósito/Stock | Gestión de grupos |
|---|---:|---:|---:|
| Usuarios, roles y permisos | V/C/E/B | – | – |
| Login y recuperación administrativa | V/C/E/B | V propia | V propia |
| Consulta de contribuyentes | V | V | V |
| Crear/editar contribuyentes | C/E/B | E | C/E/B |
| Crear/editar grupos y membresías | C/E/B | V | C/E/B |
| Cambiar referente | C/E/B | V | C/E/B |
| Historial de entregas | V | V | V |
| Productos y categorías | V/C/E/B | C/E/B | – |
| Lotes/vencimientos | V/C/E/B | C/E/B | – |
| Entradas de stock | V/C/E/B | C/E/B | – |
| Salidas por pérdida/vencimiento/ajuste | V/C/E/B | C/E/B | – |
| Recetas y versiones de bolsones | V/C/E/B | C/E/B | – |
| Confirmar entregas | V/C/E/B | C | – |
| Anular entregas confirmadas | V/C | C | – |
| Reportes de stock | V | V | – |
| Reportes de entregas | V | V | V (historial operativo) |
| Auditoría | V | – | – |

Una entrega confirmada no se edita ni se borra. Depósito o Administrador la anulan con motivo y crean una nueva. Ante faltante, Depósito ajusta las líneas reales y confirma solo lo disponible.

## Permisos de contribuyentes

Por decisión del proyecto, cualquier operador habilitado puede editar todos los campos del contribuyente, incluyendo identidad y contacto. Esta capacidad es de alto riesgo y exige:

- DNI normalizado y validación de duplicados;
- identificador municipal estable para referencias internas, si existe;
- registro obligatorio de motivo;
- valores anteriores y nuevos;
- actor y timestamp;
- auditoría inmutable;
- permisos de base de datos mínimos y explícitos.

## Entregas y receptores

- Solo Depósito y Administrador pueden confirmar una entrega.
- Gestión de grupos puede ver el historial, pero no modificarlo.
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
