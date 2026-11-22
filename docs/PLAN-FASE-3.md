# Plan de implementación — Fase 3: catálogo tipo Promob

Implementa los requisitos 3.1–3.7 de `docs/PRD.md` (3.8, curvos, queda para después: es *Puede*). Rebanadas verticales con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Referencia funcional (Promob)

De las fotos en uso (07 y 10, fuera del repo) y de la ayuda pública (`suporte.promob.com`: "Barra de modulação", "Inserir módulos", "Localizar Rápido", "Lista de Módulos"):

- **Barra de modulación** acoplada **arriba del 3D** (no a un costado). Jerarquía de pestañas: **biblioteca** (Cocinas, Dormitorios, Baños, Oficinas…) → **familia** (Inferiores, Altos, Islas, Superiores bajos/medios/altos, Tapas/Estantes, Componentes…) → **subfamilia** (Especiales, Cajoneros, Módulos p/Electrodomésticos, Lavaplatos, Diagonales, Esquineros…). Flechas **atrás/adelante**; flecha ▾ para ver la lista completa. Pestaña **Más usados** (los 30 más usados).
- Miniaturas con nombre + medida ("Mod 2P 800mm"), paginado ("7/17").
- **Insertar**: arrastrar la miniatura al 3D hasta que aparece el **recuadro verde** de posición de inserción y soltar; o **doble clic** (inserta en la posición siguiente).
- **Localizar Rápido** (`Ctrl+L`): campo *Buscar por* + *Localizar*; resultados agrupados por ruta de biblioteca, con *Expandir/Contraer todo*; elegir un resultado lo selecciona en la barra. Pie: "Se encontraron N ítems en X s".
- **Lista de Módulos** (pestaña vertical a la izquierda, junto a *Ítems extras* e *Inserción automática*): jerárquica por **plano de inserción** (piso o pared); seleccionar, **visibilidad** (lamparita; tecla `O`), **Remover** (Ctrl+clic para varios).
- Las marcas reales (Bosch, Blum, Smeg…) quedan fuera: el PRD excluye logos y modelos de marcas.

## Decisiones de diseño

### D1. Biblioteca (`src/domain/library.js`, nuevo)
- Árbol de datos: `LIBRARY = [{ id, label, groups: [{ id, label, subgroups: [{ id, label, items: [...] }] }] }]`.
- Ítem: `{ id, type, label, params?, variants? }`. `type` es un `MODULE_TYPES`; `params` pisa los valores por defecto (un mismo tipo da varios ítems: "Bajo 2P", "Cajonero 4C"…); `variants = { param: 'width', values: [300, 400, …] }` alimenta el desplegable de medidas.
- `flatItems()`, `itemPath(id)`, `searchLibrary(q)` (sin acentos ni mayúsculas, por nombre y ruta), `itemModule(item, variant)`.
- "Más usados": contador por ítem en las preferencias de la interfaz.

### D2. Barra de catálogo (`src/ui/CatalogBar.jsx`)
- Va dentro de la columna del visor, arriba del canvas; el catálogo lateral izquierdo desaparece (el visor gana ancho). A la izquierda queda una tira de pestañas verticales (Lista de módulos).

### D3. Miniaturas
- Un único `WebGLRenderer` fuera de pantalla arma el módulo con el mismo `buildModule` del 3D y lo saca a PNG; caché en memoria por ítem+variante.

### D4. Inserción
- Arrastre HTML5 desde la miniatura; sobre el canvas, el visor proyecta el puntero al piso y dibuja el **recuadro verde** del módulo con imán y colisión aplicados; al soltar se inserta ahí (un paso de deshacer). Doble clic → `newModule` (posición siguiente libre).

### D5. Visibilidad
- `module.hidden`: no se dibuja ni choca, pero sigue en el despiece y el presupuesto (como en Promob, ocultar no es borrar).

## Rebanadas

| # | Issue | Rebanada | Requisitos |
|---|---|---|---|
| S1 | #55 | Biblioteca en 3 niveles + barra de catálogo arriba del visor (atrás/adelante, Más usados, paginado) | 3.1 |
| S2 | #56 | Miniaturas generadas del modelo 3D | 3.2 |
| S3 | #57 | Desplegable de variantes de medida | 3.3 |
| S4 | #58 | Insertar arrastrando con recuadro verde; doble clic en la posición siguiente | 3.4 |
| S5 | #59 | Localizar Rápido (`Ctrl+L`) | 3.5 |
| S6 | #60 | Lista de módulos por plano de inserción, visibilidad (`O`), remover | 3.6 |
| S7 | #61 | Módulos nuevos de caja: cajoneros 4C, archivero, 2C+1P, 1C+1P, superiores bajos/medios/altos, islas, p/horno-microondas-heladera, lavaplatos, tapas, vistas, estantes | 3.7 |
| S8 | #62 | Esquineros: L izq./der. 950, L 2P, oblicuo 1P/2P 900 | 3.7 |
