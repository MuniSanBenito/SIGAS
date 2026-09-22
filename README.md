# SIGAS

**Sistema Integral de Gestión de Acción Social** de la Municipalidad de San Benito.

SIGAS es la aplicación interna de la Dirección de Acción Social. Reemplaza planillas sueltas por un circuito único y auditable: **quiénes son las familias**, **qué hay en el depósito** y **qué se entregó realmente**.

El padrón municipal sigue siendo la fuente oficial de contribuyentes. SIGAS no los duplica: los consulta en vivo, arma grupos familiares, administra el stock del depósito central y registra cada entrega con su contenido real.

## El problema

Hoy la Dirección necesita responder con confianza:

- qué productos hay realmente disponibles;
- qué se entregó, a quién, cuándo y quién lo confirmó;
- qué contenido real tuvo cada bolsón o entrega;
- qué grupos familiares existen y quién es su referente;
- qué cambios se hicieron y por qué.

Sin un sistema común, esas respuestas viven en archivos separados y no se pueden cruzar.

## Cómo funciona

```text
Padrón municipal          SIGAS                         Depósito
contribuyentes     →      grupos familiares      →      stock y recetas
consulta en vivo          referente + integrantes       bolsones versionados
                          ↓                             ↓
                          entregas de asistencia  ←  contenido real
                          historial + auditoría
```

Una entrega no es “un bolsón teórico”. Puede mezclar varios tipos de bolsón, modificar cantidades y sumar productos sueltos. Al confirmarse, el stock se descuenta por **lo que salió de verdad**, no por la receta.

## Para quién es

| Rol | Qué hace |
|---|---|
| **Administrador** | Usuarios, permisos y todos los datos. Opera también desde Payload Admin. Todo acceso sensible queda auditado. |
| **Administración** | Consulta el padrón, arma grupos familiares y confirma entregas. No toca el stock. |
| **Control de stock** | Productos, recetas, entradas, salidas y ajustes del depósito. No crea grupos ni edita contribuyentes. |

Más adelante se suman las áreas de intervención (Comedores, Niñez, Mujer, Discapacidad y Adultos Mayores, Acción Social) con visibilidad cruzada protegida.

## Qué cubre el MVP

**Incluido**

- login interno con DNI y contraseña;
- grupos familiares manuales, con referente obligatorio;
- un depósito central, con lotes y vencimientos donde el producto lo requiere;
- recetas versionadas de bolsones;
- entregas mixtas a un grupo o a una persona;
- reportes básicos de stock y entregas;
- auditoría inmutable de acciones sensibles.

**Queda para fases posteriores**

- intervenciones por área, fichas sociales y semáforo cruzado;
- solicitudes, reservas o entregas no retiradas;
- varios depósitos, portal para vecinos, app móvil o mapas.

El detalle de alcance, reglas y pendientes está en [`docs/`](./docs/00-INDICE.md).

## Stack

| Capa | Tecnología |
|---|---|
| Operación diaria | Frontend propio en Next.js |
| Backend, admin y auth | [Payload CMS](https://payloadcms.com/) 3 |
| Datos propios de SIGAS | MongoDB |
| Contribuyentes | Padrón municipal, vía adaptador (hoy mock; el real depende de Infraestructura) |
| Destino de producción | VPS |

Los grupos, el stock, las entregas y la auditoría viven en MongoDB. Los contribuyentes no.

## Cómo correrlo en local

Requisitos: Node.js 20 (o `^18.20.2`) y [pnpm](https://pnpm.io/).

1. Clonar el repositorio.
2. Instalar dependencias:

   ```bash
   pnpm install
   ```

3. Crear un `.env` en la raíz (no se versiona) con al menos:

   ```env
   DATABASE_URL=mongodb://127.0.0.1/sigas
   PAYLOAD_SECRET=cambiar-este-secreto
   ```

4. Tener MongoDB disponible. Con Docker:

   ```bash
   docker compose up mongo mongo-init
   ```

5. Levantar el entorno de desarrollo:

   ```bash
   pnpm run dev
   ```

La app queda en [http://localhost:3000](http://localhost:3000). El panel de Payload Admin está en `/admin`.

## Comandos

| Comando | Para qué |
|---|---|
| `pnpm run dev` | Servidor de desarrollo |
| `pnpm run build` | Build de producción |
| `pnpm run start` | Servir el build |
| `pnpm run lint` | ESLint |
| `pnpm run test:int` | Tests de integración (Vitest) |
| `pnpm run test:e2e` | Tests end-to-end (Playwright) |
| `pnpm run generate:types` | Regenerar tipos de Payload |

## Dónde está cada cosa

```text
src/app/(frontend)   pantallas de operación (grupos, inventario, entregas)
src/collections      modelos propios de SIGAS
src/endpoints        APIs de dominio
src/access           roles y permisos
docs/                visión, modelo, flujos y arquitectura
tasks/               plan y lista de implementación
```

## Documentación

Empezar por el [índice](./docs/00-INDICE.md).

| Documento | Contenido |
|---|---|
| [Visión y alcance](./docs/01-VISION-Y-ALCANCE.md) | Problema, usuarios, MVP y glosario |
| [Modelo de datos](./docs/02-MODELO-DE-DATOS.md) | Qué vive en SIGAS y qué sigue en el padrón |
| [Módulos](./docs/03-MODULOS-FUNCIONALES.md) | Funciones del MVP y módulos futuros |
| [Roles y permisos](./docs/04-ROLES-Y-PERMISOS.md) | Quién puede hacer qué |
| [Flujos](./docs/05-FLUJOS-DE-PROCESOS.md) | Recorridos operativos |
| [Especificación MVP](./docs/07-ESPECIFICACION-Y-ARQUITECTURA-MVP.md) | Arquitectura y criterios de aceptación |
