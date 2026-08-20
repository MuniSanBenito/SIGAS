# 05. Flujos de procesos

## Convenciones

- **Padrón municipal:** fuente externa de contribuyentes, consultada en vivo.
- **Mongo SIGAS:** datos propios de grupos, stock, entregas, usuarios y auditoría.
- **Confirmar:** acción que deja un registro efectivo y, en entregas, descuenta stock.
- **Pendiente:** regla que requiere decisión de Depósito, Dirección o Infraestructura y no debe resolverse por supuesto técnico.

## Flujo 0 — Inicio de sesión

```mermaid
flowchart TD
    A[Usuario ingresa DNI y contraseña] --> B{Credenciales válidas?}
    B -- No --> C[Registrar intento fallido y aplicar bloqueo si corresponde]
    B -- Sí --> D{Cuenta activa?}
    D -- No --> E[Denegar acceso y auditar]
    D -- Sí --> F[Crear sesión y cargar roles/áreas/permisos]
    F --> G[Registrar login exitoso]
```

La recuperación de contraseña se realiza desde el Administrador. Las contraseñas se almacenan mediante el mecanismo seguro de autenticación y nunca en texto plano.

## Flujo 1 — Buscar contribuyente en vivo

```mermaid
flowchart TD
    A[Operador busca por DNI/CUIT/datos permitidos] --> B[Adaptador consulta padrón municipal]
    B --> C{Padrón disponible?}
    C -- No --> D[Mostrar indisponibilidad y aplicar política pendiente]
    C -- Sí --> E{Existe contribuyente?}
    E -- Sí --> F[Mostrar datos actuales]
    E -- No --> G[Usuario autorizado solicita/realiza alta según permisos]
    G --> H[Validar DNI duplicado y auditar alta]
```

Si el padrón no está disponible se bloquean las operaciones que dependen de contribuyentes. No se usa caché ni carga provisoria.

## Flujo 2 — Crear grupo familiar

```mermaid
flowchart TD
    A[Gestión de grupos busca contribuyente] --> B[Selecciona referente]
    B --> C[Crea grupo activo]
    C --> D[Agrega integrantes con parentesco]
    D --> E{Integrante ya está en otro grupo activo?}
    E -- Sí --> F[Mostrar advertencia y grupos existentes]
    F --> G[Operador agrega motivo y continúa]
    E -- No --> G
    G --> H[Confirma membresías y referente obligatorio]
    H --> I[Guarda grupo y auditoría en Mongo SIGAS]
```

El grupo no guarda domicilio propio en el MVP. La ubicación operativa se obtiene del domicilio/barrio actual del referente.

## Flujo 3 — Entrada de mercadería

```mermaid
flowchart TD
    A[Depósito recibe mercadería] --> B[Selecciona producto]
    B --> C{Producto controla lote/vencimiento?}
    C -- Sí --> D[Carga lote y fecha de vencimiento]
    C -- No --> E[Continúa sin lote]
    D --> F[Indica compra o donación, fecha, cantidad y origen opcional]
    E --> F
    F --> G[Registra entrada y movimiento de stock]
    G --> H[Actualiza saldo y alerta de mínimo]
    H --> I[Audita operación]
```

## Flujo 4 — Definir una receta versionada

```mermaid
flowchart TD
    A[Depósito crea o selecciona tipo de bolsón] --> B[Incorpora productos y cantidades enteras]
    B --> C{El tipo ya tiene entregas históricas?}
    C -- No --> D[Guarda primera versión]
    C -- Sí --> E[Crea nueva versión sin alterar anteriores]
    D --> F[Marca versión vigente]
    E --> F
    F --> G[Audita receta y versión]
```

## Flujo 5 — Registrar entrega mixta

```mermaid
flowchart TD
    A[Depósito busca grupo o persona] --> B[Consulta historial de entregas]
    B --> C[Indica destino y área opcional]
    C --> D[Selecciona receptor físico]
    D --> E{Es integrante/referente?}
    E -- Sí --> F[Continúa]
    E -- No --> G[Valida que sea contribuyente y carga autorización/motivo]
    G --> F
    F --> H[Agrega uno o más tipos de bolsón]
    H --> I[Agrega modificaciones y/o productos sueltos]
    I --> J[Expande recetas y define líneas reales]
    J --> K[Selecciona lotes sensibles]
    K --> L{Stock suficiente?}
    L -- No --> M[Operador ajusta líneas reales o cancela; no hay saldo negativo]
    L -- Sí --> N[Confirma entrega efectiva]
    N --> O[Genera salida por cada línea real]
    O --> P[Actualiza saldo y alertas]
    P --> Q[Guarda fecha, confirmación, receptor y auditoría]
```

Una fecha futura sigue descontando stock al confirmar; se conserva por separado la fecha/hora real de confirmación.

## Flujo 6 — Salida no asociada a entrega

```mermaid
flowchart TD
    A[Depósito detecta vencimiento, pérdida, rotura o diferencia] --> B[Selecciona producto/lote]
    B --> C[Indica cantidad y motivo obligatorio]
    C --> D[Registra movimiento de salida/ajuste]
    D --> E[Actualiza saldo y alerta]
    E --> F[Audita actor, motivo y resultado]
```

## Flujo 7 — Corrección de datos de contribuyente

```mermaid
flowchart TD
    A[Operador detecta dato incorrecto] --> B[Consulta padrón actual]
    B --> C[Edita datos permitidos por su rol]
    C --> D[Valida DNI/CUIT y duplicados]
    D --> E[Guarda en base municipal mediante adaptador]
    E --> F[Registra antes/después, actor, hora y motivo]
```

El adaptador debe diferenciar:

- **confirmada:** la base municipal respondió que el cambio se aplicó;
- **rechazada:** la base municipal respondió con un error controlado y no aplicó el cambio;
- **incierta:** timeout, desconexión o respuesta incompleta impide saber si el cambio se aplicó.

Una operación incierta queda visible para revisión y no se reintenta sin idempotencia o verificación posterior. La estrategia completa de compensación entre la base municipal y Mongo SIGAS queda pendiente.

## Flujo 8 — Corrección de entrega confirmada

```mermaid
flowchart TD
    A[Se detecta error en entrega confirmada] --> B[Depósito o Admin anula con motivo]
    B --> C[Se generan movimientos compensatorios]
    C --> D[La entrega original queda anulada y visible]
    D --> E[Se crea una nueva entrega efectiva]
    E --> F[Se descuenta el contenido real de la nueva entrega]
    F --> G[Se audita anulación y nueva confirmación]
```

La entrega original no se borra ni se edita en silencio.

## Flujo futuro — Intervención y semáforo

Cada área registra intervenciones propias sobre un grupo o persona. Otras áreas ven solo área, última fecha y cantidad. El Administrador ve el detalle completo y los adjuntos sensibles, con auditoría.
