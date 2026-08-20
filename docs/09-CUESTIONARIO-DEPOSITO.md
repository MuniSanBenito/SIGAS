# 09. Cuestionario operativo de Depósito

## Estado

**Cerrado para el primer flujo (Gate 0) con reglas provisionales de avance.**  
Se pueden revisar con Depósito/Dirección sin bloquear login, padrón mock y grupos.

## Decisión de avance

Estas reglas desbloquean inventario y entregas. Si Depósito las cambia, se actualiza la spec y el código de esa fase; no se reescribe el primer flujo de grupos.

### 1. Falta de stock

**Regla adoptada:** se ajusta el contenido y se entrega solo lo disponible. El operador confirma las líneas reales. No se permite saldo negativo. No se reserva stock. No se genera automáticamente una segunda entrega.

- Autorización de excepción: no aplica para faltante parcial; el operador de Depósito decide el contenido real.
- Motivo obligatorio: sí, cuando la entrega difiere de la receta.
- Se informa al destinatario: mediante observación de la entrega.
- Reservar stock: no en el MVP.

### 2. Corrección de una entrega confirmada

**Regla adoptada:** se anula la entrega y se crea una nueva. La anulación genera movimientos compensatorios. Nunca se borra la entrega original.

- Quién puede anular: Administrador y Depósito.
- Motivo: obligatorio.
- Destinatario/contenido/fecha: se corrigen creando una entrega nueva, no editando la original.
- Reversión de stock: movimiento de compensación por cada línea real anulada.

### 3. Pérdidas, vencimientos y roturas

Se carga: producto, lote si aplica, cantidad, fecha, motivo, responsable y observación. Adjunto no es obligatorio. La registra Depósito o Administrador.

### 4. Lotes y vencimientos

- Lote/vencimiento: solo productos marcados como sensibles.
- Selección de lote: manual al entregar.
- Alerta de vencimiento: sí, 30 días.
- Entregar vencido: no.
- Producto próximo a vencer: alerta visible; Depósito decide si sale o se da de baja.

### 5. Entrega y recepción

- El receptor se identifica por DNI/contribuyente.
- El tercero autorizado debe ser contribuyente.
- Autorización y motivo son obligatorios para terceros y para entregas individuales sin grupo.
- Firma o comprobante: no en el MVP.
- Fecha futura: permitida; descuenta stock al confirmar.

### 6. Reportes del MVP

Incluidos:

- saldo actual por producto;
- saldo por lote cuando aplica;
- movimientos por período;
- entradas por compra/donación;
- salidas por motivo;
- productos bajo mínimo;
- próximos vencimientos;
- entregas confirmadas;
- entregas por producto;
- entregas por grupo/persona;
- entregas con diferencia respecto de la receta.

## Aprobación operativa

- Encargado/a de Depósito: `provisional — avance autorizado por el responsable del proyecto`
- Dirección: `provisional — avance autorizado por el responsable del proyecto`
- Fecha: `2026-08-19`
- Observaciones: reglas reversibles; deben validarse formalmente antes de producción.

Estas reglas ya están reflejadas en `docs/02-MODELO-DE-DATOS.md`, `docs/04-ROLES-Y-PERMISOS.md`, `docs/05-FLUJOS-DE-PROCESOS.md`, `docs/07-ESPECIFICACION-Y-ARQUITECTURA-MVP.md` y `tasks/`.
