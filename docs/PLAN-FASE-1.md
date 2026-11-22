# Plan de implementación — Fase 1: ambiente interactivo

Implementa los requisitos 1.1–1.18 de `docs/PRD.md`. Se trabaja en **rebanadas verticales**: cada una deja la app usable, con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Punto de partida (código actual)

- `src/domain/room.js`: el ambiente es un **polígono cerrado** (`room.points`) generado desde `shape` (rect/L/libre). Paredes derivadas por índice (`roomWalls`), aberturas con `wall: índice`.
- `src/ui/RoomEditor.jsx`: edición solo numérica (tabla de puntos, mínimo 3).
- `src/ui/Room3D.jsx`: dibuja paredes, esquinas, aberturas, columnas; `Dimensions` muestra largo de pared y ancho de módulo; "Paredes auto" **oculta** la pared (`visible = false`).
- `src/ui/Scene3D.jsx`: cámara en perspectiva siempre (Planta = perspectiva desde arriba); arrastre de módulos en plano horizontal; selección solo de módulos.
- `src/App.jsx`: estado con `useState` + `localStorage`, sin historial; `clampToRoom` encierra módulos en el rectángulo `w × d`.

## Decisiones de diseño

### D1. Modelo de paredes v2 (`src/domain/walls.js`, nuevo)

```js
room = {
  version: 2,
  h: 2600, t: 150,                       // valores por defecto para paredes nuevas
  nodes: [{ id, x, z }],                 // vértices compartidos (mm, coordenadas absolutas)
  walls: [{ id, n0, n1, t, h0, h1, floorGap: 0, movable: false, lowered: false, transparent: false, visible: true }],
  floor: { auto: true, points: [[x, z], ...] },
  openings: [{ id, wallId, offset, type, width, height, sill }],
  columns: [{ id, x, z, w, d }],
  refHeights: [100, 820, 1470, 2010, 2280],
  grid: { size: 50, magnetic: true },
  draw: { linear: 50, angular: 5 },
}
```

- Una pared es un tramo `n0 → n1`. **El espesor crece a la derecha del sentido de dibujo** (se dibuja en sentido horario, como Promob → el espesor queda hacia afuera).
- Grafo con cadenas **abiertas o cerradas**; un vértice puede tener 1 o 2 paredes (las uniones en T quedan fuera de la Fase 1).
- `w`, `d` pasan a ser **derivados** (caja envolvente) y solo se usan para centrar la cámara. Se **quita `clampToRoom`** como límite duro: con ambientes abiertos no tiene sentido; el imán y (en Fase 2) la colisión ordenan los módulos.
- `floor.auto = true` → el piso es el contorno interior si las paredes cierran; si no, el rectángulo envolvente + 500 mm.

### D2. Operaciones de dominio (puras, testeadas)

| Función | Regla |
|---|---|
| `migrateRoom(v1)` | `points` → `nodes` + `walls` cerrados; `opening.wall` (índice) → `wallId`. Idempotente sobre v2 |
| `wallGeometry(room)` | por pared: `a`, `b`, `len`, `u` (dirección), `n` (normal del lado del espesor), ángulo absoluto y relativo |
| `moveNode(room, nodeId, x, z)` | mueve el vértice; las paredes que lo usan lo siguen |
| `moveWall(room, wallId, dx, dz)` | traslada la pared; cada extremo **se desliza sobre la recta de la pared vecina** (intersección de rectas). Sin vecina o vecina paralela → traslación simple |
| `setWallLength(room, wallId, L)` | mueve `n1` sobre la dirección de la pared; la pared siguiente se traslada con el mismo vector (conserva su ángulo) |
| `setWallAngle(room, wallId, deg, 'abs'|'rel')` | gira alrededor de `n0`, misma propagación que `setWallLength` |
| `drawWalls(room, start, segments)` | agrega cadena; `segments = [{ len, relAngle }]`; si el último punto cae a < 1 mm del inicio, cierra |
| `deleteWalls(room, wallId, mode, { withModules })` | `mode ∈ 'tramo' | 'todas' | 'conservar'`; borra vértices huérfanos y aberturas de esas paredes; devuelve ids de módulos a borrar si `withModules` |
| `splitWall(room, wallId, offset)` | nuevo vértice; reparte aberturas según su `offset` |
| `templates.{dosParedes, rect, L, U}(medidas)` | generan `nodes` + `walls` |
| `snapCandidates(room, fw, fd)` | reescrita sobre `walls` (mismo contrato que hoy) |

### D3. Historial (`src/domain/history.js`, nuevo)

- `{ past, present, future }` con `push(state)`, `undo()`, `redo()`, límite 100.
- **Transacciones** para arrastres: `begin()` al apretar, actualizaciones sin historial durante el arrastre, `commit()` al soltar → un solo paso.
- En `App.jsx`, `useHistory` reemplaza al `useState` del proyecto; `localStorage` guarda solo `present`. `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`.

### D4. Selección y herramientas (UI)

- La selección pasa de `selectedId` a `selection = { kind: 'module' | 'wall' | 'node' | 'opening' | 'column' | 'dim', id }`.
- `tool ∈ 'select' | 'drawWall' | 'dimLinear' | 'dimAngular'`; máquina de estados chica en `src/ui/tools/`.
- **Inspector**: si hay pared seleccionada muestra *Propiedades de pared* (1.3); el resto queda igual.
- **Barra de estado** abajo del visor: tipo + medidas del seleccionado (1.16) y la herramienta activa con sus campos (Largo / Ángulo mientras se dibuja).
- **Menú contextual** (clic derecho) sobre pared: Rebajar · Transparente · Dividir aquí · Eliminar…

### D5. Vista Planta ortográfica

- En Planta, `OrthographicCamera` desde arriba, rotación bloqueada (solo pan + zoom); grilla visible y magnética (`grid.size`). Es el modo principal para dibujar y editar paredes.
- Paredes arrastrables en Planta siempre; en Perspectiva/Frente solo con `movable = true` (decisión 2 del PRD).

### D6. Cotas (`src/domain/dimensions.js`, nuevo)

- `wallDims(room)` → cotas lineales (largo **interior**) y angulares por vértice (se omiten 180°).
- `nearestDistances(item, room, modules)` → para el módulo seleccionado, distancia libre en ±X y ±Z hasta pared, columna o módulo (intersección 2D de la huella contra segmentos y rectángulos).
- `applyDimEdit(dim, valor)` → devuelve el parche que hace que la cota valga `valor` (mueve el módulo, o la pared con `moveWall`/`setWallLength`).
- `heightRuler(room, modules)` → `refHeights` + base/tope de cada módulo visible en vista Frente.
- Cotas manuales en `project.annotations = [{ id, kind: 'lin' | 'ang', points }]`.
- Render: etiquetas HTML como hoy (`.cota`), pero **clicables** → input inline, `Enter` aplica, `Esc` cancela.

### D7. Rebajar

- Altura rebajada = 100 mm (configurable). `lowered` (manual) y `transparent` (opacidad 0.25) por pared.
- **Auto Rebajar** reemplaza a "Paredes auto": misma prueba de cara a cámara que hoy, pero **baja** la pared a 100 mm en vez de ocultarla. Clic en la pared rebajada la restaura (`lowered = false`).
- El trazador de rayos (render final) sigue usando el estado visible actual.

## Rebanadas (= issues)

| # | Issue | Rebanada | PRD | Depende de |
|---|---|---|---|---|
| S1 | #1 | Historial deshacer/rehacer con transacciones | 1.15 | — |
| S2 | #2 | Modelo de paredes v2 + migración + render equivalente (sin cambios visibles) | base | — |
| S3 | #4 | Selección de paredes, panel *Propiedades de pared*, barra de estado | 1.3, 1.16 | S2 |
| S4 | #3 | Vista Planta ortográfica + grilla magnética | 1.17 | — |
| S5 | #5 | Arrastrar paredes y vértices (regla Movible) | 1.4, 1.5 | S2, S3, S4 |
| S6 | #6 | Construir paredes (clics + teclado largo/ángulo) + plantillas | 1.1, 1.2 | S2, S4 |
| S7 | #7 | Eliminar y dividir paredes + menú contextual | 1.6, 1.7 | S3 |
| S8 | #10 | Aberturas y columnas arrastrables, abertura ligada a `wallId` | 1.8 | S2, S3 |
| S9 | #11 | Rebajar / Transparente / Auto Rebajar | 1.9 | S2, S3 |
| S10 | #8 | Cotas automáticas de paredes (lineales + angulares) | 1.10 | S2 |
| S11 | #9 | Cotas de módulos a obstáculo más cercano + cotas editables | 1.11, 1.13 | S10 |
| S12 | #12 | Regla de alturas en vista Frente | 1.12 | S2 |
| S13 | #13 | Cotas manuales lineales/angulares | 1.14 | S11 |
| S14 | #14 | Importar imagen de plano con escala por 2 puntos | 1.18 | S4, S6 |

Fases 2–9: issues generales #15–#22 (etiquetas `fase-2` … `fase-9`).

Orden sugerido: **S1 → S2 → S4 → S3 → S5 → S6 → S7 → S10 → S11 → S8 → S9 → S12 → S13 → S14**.

## Riesgos

- **Coordenadas**: hoy el ambiente arranca en (0,0) y el visor centra en `w/2, d/2`. Con paredes libres, mover una pared hacia "negativo" cambia la caja envolvente. Mitigación: coordenadas absolutas y centrar la cámara solo al cambiar de vista, no en cada cambio.
- **Rendimiento del arrastre**: el corte/presupuesto ya no se recalcula al mover (clave `buildKey`); hay que mantenerlo cuando el ambiente cambia (las paredes no afectan el despiece).
- **Path tracer**: reconstruye la escena al cambiar `room`; con arrastre continuo debe quedar apagado (ya se desactiva fuera del render final).
- **e2e**: los clics en paredes necesitan un `window.__muebles.screenOfWall(id)` como el que existe para módulos.
