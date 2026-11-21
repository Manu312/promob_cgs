# MueblesApp

App web interna para diseñar muebles a medida: **diseño 3D, render fotorrealista, plan de corte y presupuesto**.
Es una alternativa propia a Promob: los módulos y sus reglas de construcción son nuestros, no se copia nada de Promob.

## Uso rápido

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests de la lógica (node:test)
npm run e2e        # prueba en Chrome real (con `npm run dev` corriendo). HEADFUL=1 usa la GPU real
npm run build      # build de producción en dist/
```

Requisitos: Node 20+ (desarrollado con Node 24), Chrome para el e2e.

## Qué hace

| Pestaña | Funciones |
|---|---|
| Diseño 3D | Ambiente con paredes, catálogo de 20 tipos de módulo (cocina, placares, baño, oficina), arrastrar con imán a paredes/vecinos, rotar, duplicar, editar medidas/puertas/cajones/divisiones/estantes/barral/mesada, materiales por proyecto o por módulo, **reglas de construcción** por proyecto o por módulo |
| Render | "Modo render" (tiempo real) y **"Render final"** (trazado de rayos con `three-gpu-pathtracer`), exportar PNG |
| Plan de corte | Optimizador guillotina (apto seccionadora/escuadradora), sierra y refilado configurables, respeta veta, placas dibujadas con % de aprovechamiento, despiece CSV |
| Presupuesto | Placas usadas + tapacanto + herrajes + mesada (m²) + mano de obra % + margen % + IVA, imprimible |
| Precios | Placas, colores, herrajes y costos editables (los valores iniciales son de prueba) |

Atajos en el 3D: `R` rotar · `Supr` borrar · flechas mover 10 mm (Shift 100 mm) · `Esc` deseleccionar.

## Estructura

```
src/domain/      Lógica pura (sin React), testeada
  catalog.js       materiales, herrajes, precios por defecto
  modules.js       tipos de módulo + motor paramétrico + reglas de construcción + ubicación/snap
  cutlist.js       resolución de materiales/reglas, despiece agrupado, metros de canto
  nesting.js       optimizador de corte guillotina
  budget.js        presupuesto
  project.js       proyecto vacío / de ejemplo
src/ui/          React + @react-three/fiber
  Scene3D.jsx      visor 3D, arrastre, cámaras, render final (path tracing)
  Inspector.jsx    panel derecho (proyecto / módulo / reglas)
  CutPlan.jsx, Budget.jsx, Settings.jsx, Catalog.jsx, fields.jsx, materials3d.js
tests/           tests unitarios del dominio
e2e/run.mjs      prueba de punta a punta con puppeteer-core sobre Chrome instalado
docs/            contexto, entorno, roadmap e inventario técnico de Promob
```

Idea central: cada módulo genera una lista de piezas (cajas alineadas a ejes, en mm). **La misma lista** alimenta el 3D, el despiece, el corte y el presupuesto, así que siempre coinciden.

Ver `docs/CONTEXTO.md` para decisiones y roadmap, y `docs/ENTORNO.md` para preparar una PC nueva.
