# PRD — MueblesApp: paridad funcional con Promob

> Estado: borrador v1 (22/11/2026) · Fuente: fotos de Promob Plus Professional ARG 5.60.48.4 en uso real + documentación pública de soporte de Promob + respuestas del usuario.

## 1. Objetivo

Que la mueblería pueda dejar Promob y hacer **todo su trabajo diario** en MueblesApp, con un flujo **lo más parecido posible** al que ya conocen: armar el ambiente, insertar y mover módulos, asignar materiales, agregar accesorios, acotar, renderizar, cortar y presupuestar.

"Parecido" = **mismo flujo y mismas funciones**. No se copian código, íconos, nombres comerciales, bibliotecas ni modelos 3D de Promob (el repo es público; ver `CLAUDE.md`).

## 2. Usuario y contexto

- **Un solo usuario**, uso interno de la mueblería, en una PC de escritorio (Chrome, mouse + teclado, pantalla ≥ 1366 px).
- Ya sabe usar Promob: los nombres de herramientas, atajos y paneles deben resultarle familiares.
- Unidades: **mm** en toda la interfaz.

## 3. Principios

1. **Una sola fuente de verdad**: la lista de piezas de cada módulo alimenta 3D, cotas, despiece, corte y presupuesto (ya existe; se mantiene).
2. **Lógica en `src/domain/`** (JS puro) con test por cada regla; UI en `src/ui/`.
3. **Todo editable con número exacto en mm** además de con el mouse (como el panel Propiedades de Promob).
4. **Deshacer/rehacer** para cualquier cambio del proyecto.
5. **Persistencia detrás de una interfaz de repositorio**: hoy `localStorage`, al final Supabase, sin tocar el resto de la app.
6. Modelos de electrodomésticos/accesorios **paramétricos y propios**, con medidas tomadas de fichas técnicas públicas de fabricantes, sin usar sus archivos 3D ni logos.

## 4. Fases

Orden acordado con el usuario. Cada fase se entrega usable y con tests.

### Fase 1 — Ambiente interactivo: paredes, cotas y deshacer

**Problema hoy**: el ambiente es un polígono cerrado editable solo con números (`RoomEditor.jsx`); no se puede arrastrar, borrar ni dibujar paredes.

**Modelo nuevo** (`src/domain/room.js`):
- `room.nodes` (vértices `[x, z]` con id) + `room.walls` (tramos `n0 → n1` con `t` espesor, `h0`/`h1` alto inicial/final, `floorGap`, `movable`, `lowered`, `visible`). Las paredes **comparten vértices**: mover uno estira a las vecinas. Cadenas **abiertas o cerradas** (se puede tener solo 2 paredes, como el arranque de Promob).
- `room.floor`: polígono propio; se ajusta solo al contorno si las paredes cierran ("ajuste de límite de piso"), si no, rectángulo editable.
- Aberturas y columnas referencian `wallId` + `offset`.
- **Migración** automática desde `room.points` (proyectos viejos siguen abriendo).

**Requisitos**
| # | Requisito | Prioridad |
|---|---|---|
| 1.1 | **Construir paredes**: clic en el piso por tramo; mientras se dibuja, escribir el largo (mm) y `Enter` pasa al ángulo relativo; incremento lineal (def. 50 mm) y angular (def. 5°) configurables; `Shift` = ortogonal; termina con clic derecho o clic en el punto inicial → "¿Cerrar el ambiente?" | Debe |
| 1.2 | **Plantillas**: 2 paredes en L (arranque por defecto), rectangular, en L, en U | Debe |
| 1.3 | **Propiedades de pared** en el panel derecho: Largo, Ángulo absoluto, Ángulo relativo, Espesor, Alto inicial, Alto final, Separación del piso, Movible, Rebajada, Visible. Cambiar Largo recalcula vecinos y cotas | Debe |
| 1.4 | **Mover pared**: arrastrarla en planta o 3D; se desplaza en paralelo y las vecinas se estiran. Respeta incremento de arrastre | Debe |
| 1.5 | **Mover vértice/esquina**: arrastrar el punto; las dos paredes lo siguen | Debe |
| 1.6 | **Eliminar pared** (`Supr` o clic derecho → Eliminar) con opciones: *Solo este tramo* · *Todas* · *Conservar la seleccionada* · casilla *Eliminar también los módulos de esa pared* | Debe |
| 1.7 | **Dividir pared** (segmentar) en un punto para tener tramos con distinto alto | Debería |
| 1.8 | **Aberturas** (ventana, puerta, vano) y **columnas** arrastrables; la abertura se desliza sobre su pared | Debe |
| 1.9 | **Rebajar**: por pared (clic derecho → Rebajar / Transparente) y **Auto Rebajar** (botón en barra inferior + menú Ver): al navegar, las paredes que tapan la vista bajan a la altura del zócalo. Reemplaza al actual "Paredes auto". Clic en el zócalo de una pared rebajada la restaura | Debe |
| 1.10 | **Cotas automáticas de paredes**: lineales (largo interior) y angulares; se crean/borran solas con los vértices | Debe |
| 1.11 | **Cotas de módulos**: distancia del módulo seleccionado a la pared o módulo más cercano en cada eje (ej. "1440" de la foto 10) | Debe |
| 1.12 | **Regla de alturas** en vista Frente: marcas de altura de referencia (por defecto 100 / 820 / 1470 / 2010 / 2280, configurables) + alturas de los módulos | Debe |
| 1.13 | **Cotas editables**: clic en el número, escribir el valor y `Enter` → mueve el objeto o la pared para que la cota valga eso | Debe |
| 1.14 | **Cotas manuales** lineales y angulares (clic-clic), seleccionables y borrables | Debería |
| 1.15 | **Deshacer/rehacer** (`Ctrl+Z` / `Ctrl+Y`), ≥ 100 pasos, cubre ambiente y módulos | Debe |
| 1.16 | **Barra de estado**: elemento seleccionado con medidas (ej. "Pared 2000×150×2600 · 5,2 m²") | Debe |
| 1.17 | **Vista Planta** ortográfica real como editor principal de paredes, con grilla magnética (tamaño configurable) | Debe |
| 1.18 | **Importar plano como imagen** de referencia con escala por 2 puntos | Puede |

**Criterios de aceptación**
- Desde un proyecto vacío se dibuja una cocina en U de 3200 × 2400 × 3000 escribiendo medidas, sin tocar el panel numérico.
- Arrastrar la pared del fondo 300 mm estira las dos laterales y actualiza cotas, piso, snap de módulos y presupuesto.
- Borrar una pared de un rectángulo deja 3 paredes y el ambiente sigue funcionando (snap, cotas, render).
- Editar la cota "1440" a "1500" mueve el módulo 60 mm.
- `Ctrl+Z` revierte cada una de las acciones anteriores en orden.
- Un `.mueble.json` del formato viejo abre igual que antes.

### Fase 2 — Movimiento y manipulación de objetos

| # | Requisito | Prioridad |
|---|---|---|
| 2.1 | **Flechas por eje** sobre el objeto seleccionado (X rojo, Y verde, Z azul); arrastrar una flecha mueve solo en ese eje | Debe |
| 2.2 | **Panel Movimiento**: pestañas *Desplazamiento* y *Rotación*; paso numérico (def. 10 mm / 90°) y botones −/+ por eje; casilla *Posición relativa* (relativa al objeto vs. coordenadas absolutas) | Debe |
| 2.3 | **Mover en altura** (eje Y) con flechas, panel y teclado | Debe |
| 2.4 | **Flechas de redimensionar** (ancho/alto/profundidad) con incremento; y medidas exactas en Propiedades | Debe |
| 2.5 | **Colisión** on/off (botón + tecla `B`): impide superponer módulos | Debe |
| 2.6 | **Acoplamientos** on/off: imán a paredes/vecinos/columnas (ya existe el imán; se vuelve conmutable) | Debe |
| 2.7 | **Rotación libre** por número; el imán solo actúa en múltiplos de 90° | Debería |
| 2.8 | **Tamaño máximo**: clic derecho → ancho/alto/profundidad máxima hasta el obstáculo más cercano | Puede |
| 2.9 | Atajos tipo Promob: `M` seleccionar/mover, `D` medir distancia, `E` propiedades, `Supr`, flechas, `R` | Debe |
| 2.10 | Apoyar objetos sobre otros (bacha sobre mesada, microondas en nicho) | Debe (lo usa la Fase 6) |

### Fase 3 — Catálogo tipo Promob

| # | Requisito | Prioridad |
|---|---|---|
| 3.1 | Catálogo en **3 niveles** de pestañas: Categoría (Cocinas, Dormitorios, Baños, Oficinas, Salas, Accesorios, Tiradores, Electrodomésticos) → Grupo (Inferiores, Altos, Islas, Superiores bajos/medios/altos, Tapas/Estantes, Componentes, Puertas/Frentes, Cajas) → Subgrupo (Especiales, Cajoneros, Módulos p/electrodomésticos, Lavaplatos, Diagonales, Esquineros, Esquineros plegables) | Debe |
| 3.2 | **Miniaturas** generadas del propio modelo 3D, con nombre + medida | Debe |
| 3.3 | **Desplegable de variantes de medida** en cada miniatura (ej. Arch. 3 caj. 300/400/450/500) | Debe |
| 3.4 | **Insertar arrastrando** desde el catálogo al 3D con recuadro verde de posición; doble clic inserta en la posición siguiente libre | Debe |
| 3.5 | **Localizar rápido** (`Ctrl+L`): búsqueda por texto en todo el catálogo, resultados en árbol por ruta, insertar desde el resultado | Debe |
| 3.6 | **Lista de módulos**: panel con todo lo insertado (seleccionar, ocultar, borrar) | Debe |
| 3.7 | **Módulos nuevos**: esquinero L izq./der. (950), esquinero L 2P, esquinero oblicuo 1P/2P (900), cajoneros 4C, archivero 3 cajones, 2C+1P, 1C+1P, módulos p/horno-microondas-heladera, lavaplatos, superiores bajos/medios/altos, islas, tapas (p/ bacha, p/ 2 bachas), vistas, estantes | Debe |
| 3.8 | Módulos curvos y cóncavos | Puede |

### Fase 4 — Modelos y estilos (materiales)

| # | Requisito | Prioridad |
|---|---|---|
| 4.1 | Panel **Modelos**: por cada tipo de pieza (Cajas, Puertas, Frentes, Tapas, Externo cajas) y accesorio (Bisagras, Patas, Correderas, Tiradores, Acabado) elegir material/modelo | Debe |
| 4.2 | **Biblioteca jerárquica**: Colores › Blanco; Maderas › …; Granitos › Gris › (nombres); Mármoles; Cuarzo | Debe |
| 4.3 | Ámbito **Todos / Selección** | Debe |
| 4.4 | **Estilos** con nombre: guardar la combinación y "Aplicar estilo" | Debe |
| 4.5 | Texturas: propias o de bancos **CC0** (ambientCG, Poly Haven); nada de Promob | Debe |
| 4.6 | Cada material lleva precio (pestaña Precios) | Debe |

### Fase 5 — Agregados, inserción automática, aperturas y tiradores

| # | Requisito | Prioridad |
|---|---|---|
| 5.1 | **Agregados** por módulo (panel + tecla `A`): pies, zócalo, zócalo trasero, ruedas, tapas, cierre de tapas, marco superior, cornisas, vistas, fondos, estantes, barral, divisiones, cajones internos; con cantidad y posición; se reflejan en despiece y presupuesto | Debe |
| 5.2 | **Inserción automática**: pestaña *Inserción* (al insertar módulos nuevos) y *Ambiente* (sobre los existentes, con "Aplicar solo en los seleccionados"); botones Insertar/Remover; listas por categoría (Cocinas, Dormitorios, Baños) | Debe |
| 5.3 | **Aperturas**: abrir/cerrar puertas y cajones en el 3D, de a uno y "abrir en cascada"; sentido de apertura editable en un diagrama del frente | Debe |
| 5.4 | **Posición del tirador**: modelo (genérico), posición (arriba/medio/abajo/personalizada en mm), orientación | Debe |
| 5.5 | **Serie**: fuera de alcance hasta que se sepa qué hace (el usuario no lo sabe y no está documentado) | — |

### Fase 6 — Electrodomésticos y accesorios

| # | Requisito | Prioridad |
|---|---|---|
| 6.1 | Modelos paramétricos propios, lo más realistas posible, con medidas de fichas técnicas públicas: cocina 4/5 hornallas (50/60/76/90), anafe, horno empotrable, campana, heladera (simple, no frost, side by side), microondas, lavavajillas, lavarropas | Debe |
| 6.2 | Bachas (simple, doble; de apoyo y bajo mesada) y griferías (monocomando caño alto/bajo, extraíble) | Debe |
| 6.3 | Baño: inodoro, bidet, lavatorio, grifería de baño | Debería |
| 6.4 | La bacha **calará la mesada** (hueco en 3D + dato en presupuesto) | Debe |
| 6.5 | Se apoyan sobre otros objetos (Fase 2.10); no entran al despiece; línea opcional en presupuesto | Debe |

### Fase 7 — Configuración del render

| # | Requisito | Prioridad |
|---|---|---|
| 7.1 | Diálogo: calidad (rápido / profesional), resolución (presets + ancho/alto con proporción bloqueable) | Debe |
| 7.2 | Sol y cielo: activar, intensidad del sol y del cielo, **azimut** y **altitud** con controles visuales | Debe |
| 7.3 | Imagen de fondo y colores de cielo/horizonte | Debería |
| 7.4 | Marca de agua (imagen del logo, transparencia, posición) | Debería |
| 7.5 | Render 360° (panorámica) | Puede |
| — | Render con IA: **fuera de alcance** por ahora | — |

### Fase 8 — Proyectos, clientes y Supabase

| # | Requisito | Prioridad |
|---|---|---|
| 8.1 | **Inicio**: lista de proyectos con búsqueda, orden por fecha de modificación, paginado; acciones abrir, duplicar, exportar, borrar | Debe |
| 8.2 | **Ficha de cliente**: nombre, persona física/jurídica, razón social, nacimiento, código, teléfono, e-mail, documento, dirección, origen, notas | Debe |
| 8.3 | **Ficha de proyecto**: nombre, tipo, situación, etapa, previsión de cierre, entrega, observaciones, etiquetas, creado/modificado | Debe |
| 8.4 | Diálogo **Proyecto nuevo** (cliente + nombre del proyecto) | Debe |
| 8.5 | **Supabase** (Postgres + Storage para renders/imágenes) detrás de la interfaz de repositorio; un solo usuario | Debe |
| 8.6 | **Login**: la app es web, así que se protege con Supabase Auth (e-mail + contraseña, registro deshabilitado, un único usuario) y políticas RLS por usuario | Debe |

### Fase 9 — Corte para taller (roadmap previo)
Orden de cortes, etiquetas por pieza imprimibles, sobrantes reutilizables.

## 5. Requisitos no funcionales

- Proyecto de 40 módulos + 8 paredes: interacción fluida (arrastre sin saltos) en la PC de la mueblería.
- Cada regla/función de dominio con test en `tests/`; cada fase con escenario e2e en `e2e/run.mjs`.
- Interfaz en español rioplatense; textos de herramientas con los nombres que usa Promob cuando sean genéricos (Rebajar, Agregados, Colisión, Acoplamientos, Localizar).

## 6. Fuera de alcance

Render con IA · muros curvos · herramienta 30-40-50 · importar DXF · multiusuario/permisos · abrir archivos `.PMOB` · logos y modelos 3D de marcas reales · herramienta "Serie".

## 7. Decisiones (22/11/2026)

1. **Serie**: fuera de alcance; el usuario no sabe qué hace. Se retoma si aparece el caso de uso.
2. **Paredes movibles**: libres en vista Planta; en 3D bloqueadas salvo que la pared tenga *Movible = Sí* (como Promob).
3. **Regla de alturas**: lista de alturas de referencia **editable** por proyecto; por defecto 100 / 820 / 1470 / 2010 / 2280 (las de las fotos).
4. **Despliegue**: app web, un solo usuario → login con Supabase Auth (ver 8.6).

## 8. Referencias

- Fotos de uso real de Promob: se guardan **fuera del repo** (es público); no se versionan.
- Soporte Promob (funcional): "Promob - Walls", "Rebaje de paredes", "Insert aggregates in the module", "Change module and geometry dimensions", "Shortcut Keys" en suporte.promob.com.
