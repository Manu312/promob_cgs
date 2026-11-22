# Plan de implementación — Fase 6: electrodomésticos y accesorios

Implementa los requisitos 6.1–6.5 de `docs/PRD.md`. Rebanadas verticales con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Criterio (decisión del usuario)

Modelos **paramétricos y propios**, lo más realistas posible, con **medidas de fichas técnicas públicas** de fabricantes del mercado argentino. **Sin** archivos 3D, logos ni nombres de marca: en el catálogo van como "Cocina 60 cm 4 hornallas", "Heladera no frost", etc. Las medidas de referencia (con su fuente) quedan en `docs/MEDIDAS-ELECTRODOMESTICOS.md`.

## Decisiones de diseño

### D1. Aparatos (`kind: 'aparato'`, `src/domain/appliances.js`)
- Un aparato se arma con **piezas decorativas** (no se cortan): caja, puertas, vidrios, perillas, hornallas, rejillas, manijas, con su terminación (`inox`, `vidrio`, `esmalte blanco`, `negro`, `cromo`, `cerámica`). Formas: caja y cilindro (eje vertical o frontal).
- **No entran al despiece**. Precio opcional (`params.price`): si es mayor que cero, va al presupuesto en el grupo *Electrodomésticos*.
- Los que van sobre otra cosa (anafe, microondas de apoyo, bacha, grifería) se insertan con **Apoyar sobre lo de abajo** activo (Fase 2.10).

### D2. Calado de la mesada (6.4)
- Antes de construir, `cutoutsFor(project)` busca cada aparato que cala (bacha bajo mesada / de apoyo, anafe) apoyado sobre un módulo con mesada o sobre una tapa, y pasa al módulo de abajo el rectángulo del hueco en sus coordenadas.
- La mesada (o la tapa) se dibuja partida alrededor del hueco y el presupuesto suma una línea **Calado de mesada** por hueco (herraje con precio editable).

### D3. Catálogo
- Biblioteca nueva **Electrodomésticos** (Cocción, Refrigeración, Lavado, Microondas) y **Accesorios** (Bachas, Griferías); en **Baños**, familia **Sanitarios**.

## Rebanadas

| # | Issue | Rebanada | Requisitos |
|---|---|---|---|
| S1 | #91 | Motor de aparatos + cocción: cocinas 50/56/60/76/90, anafes 60/75/90, horno empotrable, campanas 60/90; precio opcional | 6.1, 6.5 |
| S2 | #92 | Refrigeración, microondas y lavado: heladeras (simple, no frost, side by side), microondas (de apoyo, empotrable), lavavajillas 45/60, lavarropas (frontal, superior) | 6.1 |
| S3 | #93 | Bachas (simple, doble; de apoyo y bajo mesada) y griferías (caño alto, bajo, extraíble) + calado de la mesada | 6.2, 6.4 |
| S4 | #94 | Baño: inodoro, bidet, lavatorio (de pie, de colgar), grifería de baño | 6.3 |
