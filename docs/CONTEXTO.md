# Contexto del proyecto

Documento para retomar el trabajo desde cualquier PC o sesión (incluido Claude Code en remoto).

## Objetivo

Reemplazar el uso de **Promob Plus ARG** en la mueblería con una app **propia**, de uso interno, que cubra:
diseño 3D, renderizado, plan de corte y presupuesto. Se quieren todas las funciones que Promob da y que se usan en una mueblería.

## Decisiones tomadas (21/11/2026)

| Tema | Decisión |
|---|---|
| Plataforma | Web local: React 18 + Three.js (@react-three/fiber/drei) + Vite. Empaquetar como .exe más adelante (Electron) si hace falta |
| Muebles | Cocinas, placares/vestidores, baños/vanitorys, oficina/comercial |
| Placa principal | Melamina 18 mm, 1830 × 2600 |
| Render | Fotorrealista dentro de la app (trazado de rayos) además del modo rápido |
| Corte | Cortan ellos mismos (seccionadora / escuadradora) → planos impresos, etiquetas por pieza, orden de cortes |
| Presupuesto | Costo real (placas usadas + cantos + herrajes) + mano de obra % + margen %. Precios de prueba, editables en la app |
| Reglas de construcción | **No hay una sola correcta**: dependen del mueble y del trabajo → configurables por proyecto y por módulo |
| Promob | No se copia su código, librerías ni archivos. Solo se usó como referencia funcional (ver `PROMOB-INVENTARIO.md`) |

## Reglas de construcción configurables (hechas)

`DEFAULT_RULES` en `src/domain/modules.js`:

- **Fondo**: clavado atrás · en ranura (8 mm de profundidad, a 10 mm del canto) · sin fondo. El espesor sale del material de fondos.
- **Frentes**: superpuestos · embutidos.
- **Base**: patas regulables + zócalo · zócalo fijo (frente + trasero) · sin base.
- **Luz entre frentes**, **holgura de corredera por lado**, **retiro del zócalo** (mm).
- Material/espesor propio para **cajas de cajón**.

## Roadmap

1. ✅ MVP: diseño 3D, render rápido, despiece, corte guillotina, presupuesto, precios.
2. ✅ Reglas de construcción por proyecto/módulo, mesada, veta realista, **render final fotorrealista**.
3. ✅ **Ambientes reales** (`src/domain/room.js`, `src/ui/Room3D.jsx`, `src/ui/RoomEditor.jsx`): forma rectangular / en L / libre por puntos,
   alto y espesor de paredes, ventanas, puertas y vanos por pared, columnas, piso con la forma real, paredes que se ocultan solas
   cuando tapan la vista ("Paredes auto"), cotas de paredes y módulos ("Cotas", se activan solas en Planta), imán a paredes no
   rectangulares y a columnas. Los proyectos viejos se migran solos (`normalizeProject`).
3b. ✅ **Paridad con Promob — Fase 1, ambiente interactivo** (ver `docs/PRD.md` y `docs/PLAN-FASE-1.md`, issues #1–#14 y #29):
   deshacer/rehacer, paredes como grafo (vértices + tramos, abiertas o cerradas), Planta ortográfica con grilla magnética,
   selección y propiedades de pared, arrastrar paredes y vértices, construir paredes con clics y teclado, plantillas,
   eliminar/dividir con menú de clic derecho, cotas automáticas (lineales, angulares, de módulos a paredes/vecinos) y editables,
   flechas para estirar módulos, aberturas y columnas arrastrables, Auto Rebajar, regla de alturas, cotas manuales y plano de referencia.
3c. ✅ **Paridad con Promob — Fase 2, movimiento y manipulación** (ver `docs/PLAN-FASE-2.md`, issues #39–#46):
   colisión (`B`) y acoplamientos en la barra inferior como Promob, arrastre que no se pierde, cotas verticales
   (piso/techo), panel Herramientas · Movimiento (desplazamiento, rotación, paso, posición relativa), rotación libre,
   flechas por eje a ambos lados, módulos que acompañan a la pared, tamaño máximo (clic derecho) y apoyar sobre otros.
3d. ✅ **Paridad con Promob — Fase 3, catálogo** (ver `docs/PLAN-FASE-3.md`, issues #55–#62): barra de modulación arriba
   del visor (biblioteca → familia → subfamilia, Más usados, atrás/adelante), miniaturas renderizadas del modelo, variantes
   de medida, insertar arrastrando con recuadro verde (plano de inserción pared/piso), Localizar Rápido (Ctrl+L), Lista de
   Módulos (visibilidad `O`, remover), módulos nuevos (cajoneros, especiales, p/electrodomésticos, islas, superiores, tapas
   con bachas, vistas, estantes) y esquineros L y oblicuos. Queda para después: módulos curvos (3.8, *Puede*).
3e. ✅ **Paridad con Promob — Fase 4, modelos y estilos** (ver `docs/PLAN-FASE-4.md`, issues #71–#75): biblioteca
   jerárquica de materiales (Colores, Maderas, Fondos, Granitos › color › nombre, Mármoles, Cuarzo) con precio y texturas
   procedurales propias; material por tipo de pieza (cajas, externo, puertas, frentes, fondos, cajones, tapas) en 3D,
   despiece y presupuesto (la mesada por m² de su piedra); panel Herramientas · Modelos con menú en cascada, Mostrar todos y
   ámbito Todos / Selección; accesorios con modelos y precio (tiradores, bisagras, correderas, patas, acabado); estilos.
3f. ✅ **Paridad con Promob — Fase 5, agregados, inserción automática, aperturas y tiradores** (ver `docs/PLAN-FASE-5.md`,
   issues #81–#85): panel Agregados (tecla A: pies, zócalos, ruedas, fondo, estantes, divisiones, barral, cajones internos,
   tapa, cierre, marco, cornisa, vistas), Inserción Automática (Inserción / Ambiente por categoría), Aperturas (abrir, abrir
   todos, cascada, invertir bisagra, diagrama del frente, doble clic en el 3D) y Posición del Tirador (presets, mm, orientación).
3g. ✅ **Paridad con Promob — Fase 6, electrodomésticos y accesorios** (ver `docs/PLAN-FASE-6.md` y
   `docs/MEDIDAS-ELECTRODOMESTICOS.md`, issues #91–#94): aparatos paramétricos propios con medidas de fichas públicas
   (cocinas, anafes, horno, campanas, heladeras, microondas, lavavajillas, lavarropas), bachas y griferías que calan la
   mesada (3D + presupuesto), sanitarios de baño; no van al despiece y tienen precio opcional al presupuesto.
   Siguiente: Fase 7 (#20) — configuración del render.
4. ⏳ **Esquineros y especiales**: bajo esquinero L, alacena esquinera, horno/anafe, heladera, rebatibles, cajonera interna, alacena sobre heladera.
5. ⏳ **Corte para taller**: orden de cortes, etiquetas por pieza imprimibles, sobrantes reutilizables.
6. ⏳ **Módulo libre** a medida (editor por piezas).
7. ⏳ **Accesorios/decoración** para render: bachas, anafes, griferías, electrodomésticos.
8. Más adelante: export CNC (DXF con perforaciones), PDF para cliente con logo, Electron.

## Cómo se prueba

- `npm test` → tests del dominio (20). Cada regla nueva lleva su test.
- `npm run e2e` con `npm run dev` corriendo → abre Chrome con puppeteer-core y prueba clics, arrastres, teclado, pestañas, render y render final. Capturas en `e2e/screens/`.
  - Sin ventana usa GPU por software: el render final puede no avanzar. Usar `HEADFUL=1` (PowerShell: `$env:HEADFUL='1'`).
  - En modo desarrollo la app expone `window.__muebles.screenOf(id)` para ubicar módulos en pantalla desde el test.

## Notas técnicas

- Unidades: mm en el dominio; metros en Three.js (`S = 0.001`).
- Coordenadas locales de módulo: x ancho, y alto, z profundidad (0 = pared, `depth` = frente).
- Ambiente: `room.points` es el polígono interior (mm); la pared N va del punto N al N+1; las aberturas se ubican con `wall` (índice) y `offset` desde el inicio de esa pared. `w`/`d` son el rectángulo envolvente.
- Ubicación: `x`, `z` son la esquina mínima de la huella (ya rotada) dentro del ambiente; `rot` ∈ {0, 90, 180, 270}.
- Estado persistido en `localStorage` (`mueblesapp.project`, `mueblesapp.settings`); "Guardar archivo" exporta `.mueble.json`.
- `three-gpu-pathtracer@0.0.23`: su `dispose()` lanza error, por eso está envuelto en try/catch; el visor está dentro de un `ErrorBoundary`.
