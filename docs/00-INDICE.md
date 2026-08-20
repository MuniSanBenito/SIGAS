# SIGAS — Índice de documentación

## Estado

Esta documentación define SIGAS **antes de escribir código**. La especificación consolidada debe ser revisada y aprobada por la Dirección, Depósito y el responsable de la base municipal antes de iniciar la implementación.

## Documentos

| # | Documento | Contenido |
|---|---|---|
| 01 | [Visión y alcance](./01-VISION-Y-ALCANCE.md) | Objetivo, usuarios, MVP, fases y glosario |
| 02 | [Modelo de datos](./02-MODELO-DE-DATOS.md) | Datos propios de SIGAS, referencias al padrón y reglas de integridad |
| 03 | [Módulos funcionales](./03-MODULOS-FUNCIONALES.md) | Funciones del MVP y módulos posteriores |
| 04 | [Roles y permisos](./04-ROLES-Y-PERMISOS.md) | Roles, áreas, permisos y auditoría |
| 05 | [Flujos de procesos](./05-FLUJOS-DE-PROCESOS.md) | Flujos confirmados y decisiones pendientes |
| 06 | [Roadmap y fases](./06-ROADMAP-Y-FASES.md) | Orden de construcción y checkpoints |
| 07 | [Especificación y arquitectura MVP](./07-ESPECIFICACION-Y-ARQUITECTURA-MVP.md) | Fuente consolidada para aprobación |
| 08 | [Contrato del padrón municipal](./08-CONTRATO-PADRON-MUNICIPAL.md) | Datos técnicos que debe completar Infraestructura |
| 09 | [Cuestionario de Depósito](./09-CUESTIONARIO-DEPOSITO.md) | Reglas operativas que debe validar Depósito/Dirección |

## Plan de ejecución

- [Plan de implementación](../tasks/plan.md) — dependencias, fases, riesgos y checkpoints.
- [Lista de tareas](../tasks/todo.md) — tareas verificables y gates de aprobación.

## Cómo usar estos documentos

1. El documento **01** define qué problema se resuelve y qué queda fuera.
2. El documento **02** define qué información pertenece a SIGAS y qué información sigue en el padrón municipal.
3. Los documentos **03**, **04** y **05** traducen el alcance a funcionalidades, permisos y recorridos concretos.
4. El documento **06** ordena la construcción por entregas verticales.
5. El documento **07** reúne las decisiones arquitectónicas, criterios de aceptación, límites y bloqueos que deben aprobarse antes de programar.

## Decisiones confirmadas principales

- El MVP prioriza **grupos familiares + inventario + entregas**.
- Hay un único depósito central en el primer corte.
- Las entregas las confirma Depósito y descuentan stock al confirmarse.
- Una entrega puede contener varios tipos de bolsón, contenido modificado y productos sueltos.
- Las recetas de bolsones se versionan.
- Los grupos se crean manualmente; una persona puede pertenecer a varios grupos activos.
- El padrón municipal sigue siendo la fuente oficial de contribuyentes y se consulta en vivo; SIGAS puede crear y actualizar contribuyentes mediante un adaptador controlado.
- SIGAS mantiene sus propios datos en MongoDB.
- Payload CMS, frontend propio y VPS son decisiones técnicas preliminares, no una aprobación definitiva del stack.
- La auditoría de acciones sensibles es obligatoria e inmutable.

## Validaciones externas pendientes

Antes de implementar se deben obtener respuestas de los responsables correspondientes sobre:

- comportamiento ante stock insuficiente o entregas parciales;
- corrección o reversión de entregas confirmadas;
- disponibilidad de la base municipal y comportamiento ante caída;
- motor, esquema, permisos, identificador estable y conectividad del padrón;
- backups, recuperación, retención de auditoría y protección de datos;
- estrategia de consistencia entre MongoDB y la base municipal.
