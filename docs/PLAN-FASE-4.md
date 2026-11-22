# Plan de implementación — Fase 4: modelos y estilos (materiales)

Implementa los requisitos 4.1–4.6 de `docs/PRD.md`. Rebanadas verticales con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Referencia funcional (Promob)

De la foto 04 (fuera del repo) y de la ayuda pública (`suporte.promob.com`: "Definir modelos para o módulo", "Como configurar estilos de modelos", "Catalog – Materiais"):

- **Herramientas · Modelos**: arriba, *Estilos* con **Aplicar estilo** (y botones para guardar/editar); pestañas de ámbito **Todos / Selección**; abajo, filas por tipo de pieza (Cajas, Puertas, Frentes, Tapas, Externo cajas…) y un grupo **Accesorios** (Bisagras, Patas, Correderas, Tiradores, Acabado). Cada fila muestra la ruta del modelo actual ("Colores > Blanco", "Granitos > Amarillo > …").
- Clic en el valor abre un **menú en cascada** por la jerarquía (*Mostrar todos…*, Granitos ›, Mármoles ›, Cuarzo ›; Granitos › Amarillo, Azul, Beige, Blanco, Gris, Marrón…; y los nombres). *Mostrar todos* abre la lista completa.
- **Todos**: aplica a todos los módulos del ambiente **y a los que se inserten después**. **Selección**: solo a los módulos elegidos.
- **Estilos**: *Guardar nuevo estilo* (nombre + tildar qué modelos incluye), *Aplicar estilo* (elegirlo), *Editar estilos* (renombrar, borrar). Guardar con el mismo nombre lo actualiza.
- Los **tiradores** tienen *modelos*; lo demás son *materiales*. El presupuesto usa los precios de los modelos elegidos.
- Materiales de color (color base) o de textura (imagen). Nada de las texturas de Promob: las nuestras son **procedurales** (madera, piedra), es decir propias.

## Decisiones de diseño

### D1. Biblioteca de materiales (`src/domain/catalog.js`)
- Cada material lleva `path` (ruta en la biblioteca) y `kind`: `'placa'` (se corta: espesor, largo, ancho, precio por placa) o `'piedra'` (tapas/mesadas: precio por m², color base + color de grano).
- Biblioteca por defecto: **Colores** › Blanco, Gris grafito, Negro…; **Maderas** › Roble, Nogal…; **Fondos** › Fibrofácil; **Granitos** › color › nombre (Gris Mara, Negro Brasil, Blanco Dallas, Verde Ubatuba, Café Imperial, Amarillo Ornamental…); **Mármoles** › Carrara, Travertino; **Cuarzo** › Blanco, Gris. Nombres comerciales genéricos de piedras, nada de Promob.
- `libraryTree(materials, kind)` arma el árbol para el menú en cascada; `migrateSettings` completa `path`/`kind` en materiales viejos y suma las piedras que falten.

### D2. Tipos de pieza (slots)
- `cajas` (piso, techo, divisiones, estantes, zócalo, travesaños) · `externo` (laterales) · `puertas` · `frentes` (frentes de cajón, vistas, frente fijo) · `fondos` · `cajones` (cajas de cajón) · `tapas` (mesadas y tapas de piedra).
- `slotOf(part)` por rol + nombre de la pieza. `project.defaults` pasa a tener un material por slot (migración: `cuerpo` → cajas y externo; `frente` → puertas y frentes; `fondo` → fondos; `cajon` → cajones; tapas → granito por defecto). `module.mats` pisa por slot (Selección).
- La mesada deja de ser un precio único: va al presupuesto como "Tapa <piedra>" por m² con el precio de esa piedra.

### D3. Accesorios con modelos
- `settings.accessories = { tiradores: [...], bisagras: [...], correderas: [...], patas: [...], acabado: [...] }`, cada modelo con nombre y precio (acabado = tapacanto, $/m). Elegidos por proyecto (`project.defaults.acc`) y por módulo (`module.acc`). El presupuesto usa el modelo elegido; el 3D dibuja el tirador según su modelo (barral corto/largo, botón, perfil).

### D4. Estilos
- `settings.styles = [{ id, name, models: { slot|acc: id } }]` (globales, como en Promob). Aplicar a Todos o a la Selección; guardar con el mismo nombre actualiza.

## Rebanadas

| # | Issue | Rebanada | Requisitos |
|---|---|---|---|
| S1 | #71 | Biblioteca jerárquica de materiales (placas y piedras) con precio y textura procedural de piedra; pestaña Precios agrupada | 4.2, 4.5, 4.6 |
| S2 | #72 | Tipos de pieza (cajas, externo, puertas, frentes, fondos, cajones, tapas) en 3D, despiece y presupuesto | 4.1 |
| S3 | #73 | Panel Herramientas · Modelos con menú en cascada, *Mostrar todos* y ámbito Todos / Selección | 4.1, 4.3 |
| S4 | #74 | Accesorios con modelos y precio: tiradores, bisagras, correderas, patas, acabado | 4.1, 4.6 |
| S5 | #75 | Estilos: guardar, aplicar, renombrar, borrar | 4.4 |
