# 01. Visión y alcance

## Objetivo general

SIGAS será un sistema interno para la Dirección de Acción Social que permita operar un circuito único y auditable:

1. consultar y mantener contribuyentes del padrón municipal mediante una conexión controlada;
2. organizar contribuyentes en grupos familiares creados manualmente;
3. administrar el inventario de un depósito central;
4. definir recetas versionadas de bolsones;
5. registrar entregas a grupos o personas, incluyendo bolsones mixtos y productos sueltos;
6. consultar el historial de asistencia y el estado del stock;
7. incorporar posteriormente las intervenciones de las distintas áreas con visibilidad cruzada protegida.

## Problema que resuelve

La Dirección necesita reemplazar planillas separadas y poder responder con confianza:

- qué productos hay realmente disponibles;
- qué se entregó, a quién, cuándo y quién lo confirmó;
- qué contenido real tuvo cada entrega;
- qué grupos familiares existen y quién es su referente;
- qué cambios fueron realizados y por qué.

## Éxito del MVP

El MVP se considera útil cuando:

- Depósito puede consultar un saldo confiable por producto.
- Depósito puede registrar entradas, salidas, ajustes y entregas con auditoría.
- Gestión de grupos puede crear grupos desde el padrón municipal.
- Una entrega puede apuntar a un grupo o a una persona y conservar su detalle real.
- El historial de entregas se puede consultar por destinatario y período.
- Los reportes básicos de stock y entregas reemplazan el circuito operativo de planillas.

## Alcance del MVP

### Incluido

- usuarios internos con login por DNI y contraseña;
- roles y permisos configurables;
- áreas y roles administrados como conceptos independientes;
- administración completa desde Payload Admin para el Administrador;
- frontend propio para las operaciones diarias;
- consulta en vivo del padrón municipal;
- creación y actualización de contribuyentes mediante adaptador controlado;
- grupos familiares manuales, con un referente obligatorio;
- pertenencia múltiple permitida con advertencia y motivo;
- un depósito central;
- productos con unidades enteras y mínimo configurable;
- lotes y vencimientos solo para productos configurados como sensibles;
- entradas por compra o donación;
- salidas por entrega, vencimiento, pérdida, rotura o ajuste;
- recetas versionadas de bolsones;
- entregas mixtas de recetas, modificaciones y productos sueltos;
- destinatario grupal o individual;
- receptor físico identificado como contribuyente; tercero autorizado con motivo;
- área de asistencia opcional;
- fecha de entrega flexible, con fecha/hora de confirmación separada;
- reportes de stock y entregas;
- auditoría inmutable de acciones sensibles;
- producción prevista en VPS.

### Fuera del MVP

- intervenciones por área y fichas sociales;
- semáforo de intervenciones, aunque la arquitectura lo reserva para una fase posterior;
- solicitudes, reservas, preparaciones o entregas no retiradas;
- reglas automáticas de frecuencia de asistencia;
- firma digital y comprobantes adjuntos de entrega;
- programas, expedientes y convenios como entidades obligatorias;
- múltiples depósitos y transferencias entre depósitos;
- mapas y georreferenciación;
- portal para vecinos o turnos online;
- aplicación móvil nativa;
- módulo contable, compras o presupuesto.

## Usuarios iniciales

| Perfil | Responsabilidad principal |
|---|---|
| **Administrador** | Gestiona usuarios, roles, permisos y todos los datos desde Payload Admin. Su acceso es completo y auditado. |
| **Gestión de grupos** | Consulta y actualiza contribuyentes; crea y mantiene grupos, referentes, integrantes y parentescos. Consulta historial de entregas, sin modificar stock ni entregas. |
| **Depósito/Stock** | Gestiona productos, recetas, entradas, salidas y confirma entregas. Consulta grupos y puede corregir datos de contribuyentes, pero no modifica la composición de grupos. |

Las áreas de intervención y Dirección/Supervisión se incorporarán como usuarios operativos en fases posteriores.

## Áreas futuras

Las áreas se administrarán como datos configurables:

1. Comedores.
2. Niñez, Adolescencia y Familia.
3. Mujer.
4. Discapacidad y Adultos Mayores.
5. Acción Social.

Cada área podrá registrar intervenciones propias. El semáforo futuro mostrará a otras áreas únicamente área, última fecha y cantidad; el Administrador tendrá acceso completo, siempre auditado.

## Glosario

| Término | Definición |
|---|---|
| **Contribuyente** | Persona del padrón municipal. El DNI es el identificador de búsqueda principal; CUIT es un dato adicional. La referencia técnica deberá usar un ID municipal inmutable si existe. |
| **Grupo familiar** | Conjunto de contribuyentes seleccionado manualmente, con un referente obligatorio y membresías con ciclo de vida propio. |
| **Referente** | Integrante principal del grupo. Su domicilio y barrio se usan como ubicación operativa del grupo. |
| **Producto** | Insumo individual controlado por unidades enteras y stock. |
| **Bolsón** | Receta versionada que define productos y cantidades esperadas. |
| **Contenido real** | Productos y cantidades que efectivamente salieron en una entrega, aunque difieran de la receta. |
| **Entrega** | Confirmación de una asistencia efectiva que puede contener varios bolsones, modificaciones y productos sueltos, y que genera salidas de stock. |
| **Receptor físico** | Persona que retira la entrega. Debe ser integrante/referente o un tercero contribuyente autorizado. |
| **Auditoría** | Registro inmutable de acciones sensibles, actor, fecha/hora, objetivo, motivo y valores anteriores/nuevos cuando corresponda. |

## Decisiones que requieren validación externa

Estas no se deben inventar durante la implementación:

- qué ocurre cuando falta stock en una línea de la entrega;
- cómo se corrige o revierte una entrega ya confirmada;
- si se puede trabajar cuando el padrón municipal no responde;
- motor, ID estable, esquema y permisos de la base municipal;
- política de backups, recuperación, retención y protección de datos.
