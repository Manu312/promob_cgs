# Plan de implementación — Fase 2: movimiento y manipulación de objetos

Implementa los requisitos 2.1–2.10 de `docs/PRD.md` y los problemas que reportó el usuario al probar la Fase 1. Igual que en la Fase 1: **rebanadas verticales**, cada una con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Referencia funcional (Promob)

De las fotos de Promob en uso (fuera del repo) y de la ayuda pública de Promob (`suporte.promob.com`: "Teclas de atalhos", "Colisão", "Reposicionar", "Calcular distância"):

- **Panel Herramientas** (a la derecha, fijable) con secciones *Modelos · Movimiento · Propiedades · Serie*. *Movimiento* tiene pestañas **Desplazamiento** y **Rotación**: una fila por eje con flecha **−** a la izquierda y **+** a la derecha (rojo = ancho, verde = profundidad, azul = alto), un **paso** numérico (10 por defecto) y la casilla **Posición relativa**.
- **Barra inferior derecha** con interruptores: *Mostrar ▾*, **Colisión**, **Acoplamientos**, **Auto Rebajar**. El activo se ve enmarcado.
- **Colisión** (tecla `B`): activada, los módulos no se superponen entre sí ni con las paredes, tanto con el mouse como con el teclado. Desactivada, se superponen.
- Sobre el objeto seleccionado: **flechas de colores por eje en ambos lados** (rojo izquierda/derecha, verde adelante/atrás, azul arriba/abajo).
- Atajos: `M` seleccionar/mover · `B` colisión · `D` calcular distancia · `E` propiedades · `R` rotar · `X`/`Y` trabar movimiento en un eje · flechas mueven (izq., der., atrás, adelante) · `Supr` · `Ctrl+D` duplicar · `Ctrl+Shift+M` movimiento.
- Cotas al mover: distancia a paredes, a otros módulos **y en vertical** (foto 10: "1715" del módulo hacia arriba).

Serie queda fuera de alcance (decisión del usuario). *Modelos* llega con la Fase 4.

## Problemas reportados (22/11/2026)

1. **El arrastre se pierde al pasar por una pared.** Reproducido: en Perspectiva el punto agarrado se proyecta sobre un plano horizontal; hacia el horizonte la proyección se dispara (el módulo terminó en x = −137 m) y nada lo frena contra las paredes. → S1.
2. **No hay cota contra el piso** (un mueble a 50–100 mm del piso no muestra esa distancia). `nearestDistances` solo mide en planta. → S2.

## Decisiones de diseño

### D1. Colisión (`src/domain/collision.js`, nuevo)
- Cada objeto es un polígono convexo en planta + un rango de alto: módulo (rectángulo orientado por `rot`, `y … y+alto`), pared (cuadrilátero `a, b, b+n·t, a+n·t`, `0 … alto`), columna (rectángulo, alto del ambiente).
- `overlaps(A, B)`: separación por ejes (SAT) con tolerancia de 0,5 mm; tocarse no es chocar.
- `collideMove(mod, x, z, room, modules)`: mueve primero en x y después en z (así **se desliza** contra una pared), avanzando de a ≤ 40 mm para no atravesar paredes finas y ajustando el contacto por bisección. Los obstáculos que ya estaban superpuestos al empezar se ignoran (no queda trabado si se activó la colisión con algo encimado).
- Colisión y Acoplamientos son preferencias de la interfaz (persisten en `localStorage`), no del proyecto.

### D2. Arrastre robusto
- Se descarta la intersección con el plano de arrastre si queda a más de 30 m de la cámara (cerca del horizonte): el módulo queda donde estaba en vez de saltar.
- Con Colisión, cada movimiento parte de la posición actual del módulo hacia el destino imantado.

### D3. Cotas verticales
- `verticalDistances(mod, room, modules)`: hacia abajo, al piso o a la cara superior del módulo de abajo (que se superpone en planta); hacia arriba, al techo (alto de la pared más baja) o a la cara inferior del módulo de arriba. Editables como las demás (mover en altura).

### D4. Panel Herramientas
- La columna derecha pasa a tener la botonera de secciones *Movimiento · Propiedades* (y *Modelos* deshabilitado hasta la Fase 4). *Propiedades* es el inspector actual.
- `nudge(mod, axis, sign, step, { relative })`: con *Posición relativa* el ±paso es en los ejes del módulo (rotado); sin ella, en los ejes del ambiente. Rotación: ±paso en grados (90 por defecto).

### D5. Rotación libre
- `rot` puede ser cualquier ángulo. `footprint` pasa a ser la **caja envolvente** del módulo rotado (`x, z` siguen siendo su esquina mínima). El imán actúa solo en múltiplos de 90°; la colisión usa el rectángulo orientado.

### D6. Módulos que acompañan la pared
- Al mover o arrastrar una pared, los módulos apoyados en ella (`modulesOnWall`) se trasladan con el mismo desplazamiento (decisión por defecto informada al usuario).

## Rebanadas

| # | Issue | Rebanada | Requisitos |
|---|---|---|---|
| S1 | #39 | Colisión (`B`) + arrastre que no se pierde + barra inferior Mostrar / Colisión / Acoplamientos / Auto Rebajar | 2.5, 2.6, problema 1 |
| S2 | #40 | Cotas verticales (piso, techo, módulo de abajo/arriba), editables | 1.11, problema 2 |
| S3 | #41 | Panel Herramientas: Movimiento (Desplazamiento/Rotación, paso, ±, Posición relativa) + Propiedades; mover en altura; atajos `E`, `Ctrl+Shift+M`, `Ctrl+D`, `X`/`Y`, `M` | 2.2, 2.3, 2.9 |
| S4 | #42 | Rotación libre por número; imán solo a 90° | 2.7 |
| S5 | #43 | Flechas por eje sobre el objeto, a ambos lados y con los colores de Promob | 2.1, 2.4 |
| S6 | #44 | Los módulos apoyados acompañan a la pared que se mueve | — |
| S7 | #45 | Tamaño máximo hasta el obstáculo (clic derecho en el módulo) | 2.8 |
| S8 | #46 | Apoyar objetos sobre otros (al soltar sobre una tapa, toma su altura) | 2.10 |
