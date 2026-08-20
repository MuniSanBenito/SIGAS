# 06. Roadmap y fases de implementación

## Principio de construcción

SIGAS se construirá mediante cortes verticales: cada fase debe dejar un flujo usable, probado y auditable. No se comienza por todas las tablas o todas las pantallas de forma aislada.

## Fase 0 — Cierre de especificación y relevamiento

Antes de elegir dependencias o escribir código:

- aprobar los documentos 01 a 07;
- validar stock insuficiente y corrección/reversión de entregas con Depósito/Dirección;
- relevar el motor, esquema, ID estable, permisos y conectividad del padrón municipal;
- confirmar la política ante caída del padrón;
- confirmar backups, recuperación, auditoría y protección de datos;
- documentar la estrategia de consistencia entre MongoDB y el padrón externo.

**Gate:** no se inicia implementación mientras alguno de estos puntos críticos sea desconocido.

## Fase 1 — Spike técnico de arquitectura

Objetivo: probar las decisiones de mayor riesgo antes del MVP.

- levantar una aplicación mínima con Payload y MongoDB;
- validar autenticación con DNI y contraseña;
- validar frontend propio contra la API/backend;
- consultar el padrón municipal desde el VPS mediante el adaptador;
- probar lectura y una operación de escritura controlada;
- comprobar el identificador estable del contribuyente;
- probar auditoría y manejo de errores entre bases;
- documentar si Payload sigue siendo viable.

**Resultado:** decisión técnica aceptada o cambio de stack antes de construir funcionalidades.

## Fase 2 — Usuarios, contribuyentes y grupos

Flujo vertical: usuario autorizado → búsqueda en padrón → grupo familiar.

Incluye:

- usuarios, login, restablecimiento administrativo y permisos;
- roles y áreas independientes;
- consulta/alta/actualización de contribuyentes;
- auditoría de cambios;
- grupos manuales;
- referente obligatorio;
- parentescos configurables;
- membresías múltiples con advertencia y motivo;
- bajas lógicas.

**Checkpoint:** se puede crear un grupo válido desde el padrón sin duplicar contribuyentes en Mongo.

## Fase 3 — Inventario central y recetas

Flujo vertical: producto → entrada → saldo → receta versionada.

Incluye:

- productos y categorías;
- unidades enteras;
- stock mínimo;
- lotes/vencimientos sensibles;
- entradas por compra/donación;
- salidas por vencimiento/pérdida/rotura/ajuste;
- recetas y nuevas versiones;
- saldo y movimientos auditados.

**Checkpoint:** el saldo coincide con los movimientos y una receta nueva no altera las anteriores.

## Fase 4 — Entregas efectivas

Flujo vertical: destino → receptor → contenido mixto → confirmación → salida de stock → historial.

Incluye:

- destino grupal o individual;
- área opcional;
- receptor integrante/referente o tercero contribuyente autorizado;
- varios bolsones/versiones y productos sueltos;
- líneas reales y lotes;
- fecha de entrega y confirmación separadas;
- movimientos de salida;
- historial por destinatario;
- regla de stock insuficiente aprobada.

**Checkpoint:** una entrega mixta confirmada genera exactamente las salidas reales y queda visible para Depósito y Gestión de grupos según permisos.

## Fase 5 — Reportes, auditoría y endurecimiento

Incluye:

- reportes de stock, mínimos y vencimientos;
- reportes de entregas por período, destinatario, producto, área y barrio;
- búsqueda y filtros operativos;
- auditoría consultable por Administrador;
- corrección/reversión de entregas según política aprobada;
- backup, recuperación, monitoreo y seguridad del VPS;
- pruebas de permisos y concurrencia.

**Checkpoint de MVP:** se reemplaza el circuito operativo de planillas para el piloto definido.

## Fase 6 — Intervenciones por área

- intervenciones grupales o individuales;
- tipos y estados propios;
- fichas, estudios, visitas y adjuntos;
- permisos por área;
- auditoría de acceso sensible.

## Fase 7 — Semáforo y coordinación

- resumen cruzado por área/última fecha/cantidad;
- restricciones para detalle y adjuntos;
- acceso completo del Administrador auditado;
- reportes globales y coordinación interdisciplinaria.

## Fase posterior

- mapa/georreferenciación;
- portal ciudadano y turnos;
- aplicación móvil;
- múltiples depósitos y transferencias;
- programas/expedientes;
- exportaciones oficiales automatizadas;
- notificaciones y derivaciones formales.

## Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Padrón incompatible o sin ID estable | Alto | Spike técnico antes del MVP; adaptador aislado |
| Fallo entre Mongo y padrón externo | Alto | Idempotencia, timeout, resultado incierto visible y auditoría |
| Stock insuficiente no definido | Alto | Decisión formal con Depósito antes de Fase 4 |
| Corrección de entrega no definida | Alto | Diseñar reversión/compensación antes de habilitar edición |
| Admin o roles evaden invariantes | Alto | Servicios compartidos, permisos backend y pruebas de autorización |
| Pérdida de datos en VPS | Alto | Backups probados, monitoreo y procedimiento de recuperación |
| Exposición de datos sensibles | Alto | Mínimo privilegio, TLS, auditoría de accesos y validación institucional |

## Relación con las tareas

El desglose verificable de este roadmap está en [`tasks/plan.md`](../tasks/plan.md) y [`tasks/todo.md`](../tasks/todo.md). Las tareas 0.1 y 0.2 son gates obligatorios antes de crear funcionalidades.

Los insumos para esos gates están preparados en [08. Contrato del padrón municipal](./08-CONTRATO-PADRON-MUNICIPAL.md) y [09. Cuestionario de Depósito](./09-CUESTIONARIO-DEPOSITO.md).

## Criterio para comenzar a programar

Se puede iniciar implementación únicamente cuando:

- el documento 07 esté aprobado;
- la Fase 0 tenga evidencia del relevamiento de base e infraestructura;
- la política de stock insuficiente esté decidida;
- la política de corrección de entregas esté decidida;
- exista un primer backlog con tareas verificables;
- el usuario apruebe explícitamente el stack y el primer corte.
