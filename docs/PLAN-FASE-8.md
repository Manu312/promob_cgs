# Plan — Fase 8: proyectos en la nube (Supabase)

Decisiones del usuario (23/11/2026):

- **2 o 3 usuarios** que trabajan como **equipo**: todos ven los mismos proyectos.
- **Guardado automático** en Supabase unos segundos después de cada cambio, con **copia local**
  por si se corta internet.
- Imágenes y modelos pesados a **Supabase Storage**, siempre que siga siendo **costo 0**
  (plan gratis: 500 MB de base, 1 GB de archivos; el proyecto se pausa tras una semana sin uso y
  se reactiva desde el panel).
- **Más adelante** (issues aparte): precios y materiales en la nube (#172) y la ficha de cliente
  completa (#173). Mientras tanto el proyecto guarda el **nombre del cliente** como texto.
- Login ya hecho (#171): código por email, solo usuarios invitados.

Antes de la Fase 8 (pedido del usuario): **encastre** de bacha y horno, y Modelos aplicado a
toda la selección.

## Arquitectura

- **Repositorio de proyectos** (`src/domain/projectsRepo.js`): una interfaz única
  (`list`, `get`, `save`, `remove`, `duplicate`) con dos implementaciones:
  - **local** (navegador): la que usan las pruebas y la app sin login;
  - **Supabase** (tabla `projects`, JSON del proyecto + datos de la ficha), con RLS: solo usuarios
    autenticados (que son los invitados del equipo).
- **Guardado**: cada cambio se guarda en la copia local al instante; a la nube con demora
  (debounce). Estado visible: *Guardado*, *Guardando…*, *Sin conexión: guardado en esta compu*.
  Si hay dos ediciones del mismo proyecto, gana la última (2–3 usuarios, sin edición simultánea).
- **Archivos** (Storage, bucket privado `assets`): el proyecto guarda la ruta, no la imagen.

## Slices

| # | Slice | Issue |
|---|---|---|
| E | Encastre de bacha y horno (se acomodan solos y acompañan al mueble) + Modelos a la selección | #174 |
| 1 | Inicio: lista de proyectos (búsqueda, orden por modificación, paginado; abrir, duplicar, exportar, borrar), Proyecto nuevo (nombre + cliente) y datos del proyecto (tipo, situación, etapa, previsión de cierre, entrega, observaciones, etiquetas). Repositorio local | #175 |
| 2 | Supabase: tabla `projects` + RLS (SQL en `supabase/`), repositorio Supabase, guardado automático con copia local, estado de guardado, subir los proyectos que ya están en el navegador | #176 |
| 3 | Storage: plano de referencia, modelos 3D, capturas de impresión e imágenes de favoritos como archivos en el bucket `assets` | #177 |

## Configuración que hace el usuario (una vez)

1. Ejecutar `supabase/001_proyectos.sql` en *SQL Editor* de Supabase (crea la tabla, las
   políticas y el bucket).
2. Nada más: la app usa las variables del `.env` / del hosting que ya están.
