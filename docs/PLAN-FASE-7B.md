# Plan — Fase 7b: paridad de diseño con Promob

Pedido del usuario (23/11/2026): la funcionalidad de diseño tiene que ser **idéntica a Promob**. Se prioriza antes que la auditoría de seguridad y que la Fase 8.

Epic: ver la tabla de issues al final.

## Cómo se armó

1. Auditoría de la app contra el índice completo de la ayuda de Promob (`suporte.promob.com/hc/pt-br`, categoría Design) y contra las fotos de Promob en uso (fuera del repo).
2. Lectura de ~45 artículos de la ayuda de Promob, entre ellos:
   - Paredes, Piso, Réguas, Faixas, Regiões, Escadas.
   - Materiais, Copiar material, Importar planta baixa, Importar arquivo 3D.
   - Agrupar, Duplicar, Substituição rápida, Tamponamento.
   - Vistas, Vista dinâmica, Movimentação 3D, Rotacionar, Modos de preenchimento.
   - Inserir módulo, Plano de inserção, Favoritos, Alterar dimensões, Preferências, Interface, Teclas de atalhos.
   - Geometria, Converter para painel, Furar, Área molhada.
   - Página de impressão, Viewport, Cotas, Camadas, Texto, Imagem, Listagem.
   - Editor de luzes, Decore, Construtor de armários, Portas deslizantes, Aberturas, Gola.
3. La documentación REA disponible solo tiene metadatos de la instalación (`docs/PROMOB-INVENTARIO.md`). No hay documentación funcional de REA.

Regla del repo: Promob es solo referencia funcional. No se copian código, íconos, modelos, texturas ni catálogos de fabricantes. Los nombres de las funciones van en español rioplatense, con el mismo sentido que en Promob.

## Qué falta o es distinto (resumen de la auditoría)

| Área | Promob | MueblesApp hoy |
|---|---|---|
| Selección y edición | Ctrl+clic, Ctrl+T, agrupar (U / Ctrl+U), copiar/cortar/pegar, duplicar con ventana *Reposicionar*, sustitución rápida, ubicar en la barra de modulación | Selección simple; duplicar sin ventana |
| Movimiento | Ctrl+flechas hasta el extremo, Ctrl+Inicio centra en X, Shift+mouse gira, I invertir, H mover hotpoint | No |
| Inserción | Orientación (Horizontal, Vertical, en el plano) y dirección de inserción; cambiar de plano con clic derecho al arrastrar; Desasociar; ítems lineales sobre varios módulos | Plano automático (pared o piso) |
| Vistas | Menú Vistas (isométrica derecha por defecto), volver/avanzar (20), F8, zoom total, zoom entidad, zoom ventana, Caminar, Vista dinámica; doble clic en pared → frontal, en piso → planta | Perspectiva, Frente, Planta |
| Visualización | 9 modos de relleno (F10) | Normal y Modo render |
| Paredes | Curvas (Flecha y hotpoints), Encuentro canto/T, 30-40-50, Bloquear ángulo, construir con referencia, extremos, tipo (normal/Dry Wall) | Rectas |
| Piso | Ajustar límites, forma por vértices, flechas, piso padrón 5000×5000, grilla del piso con atracción | Automático |
| Réguas | Grupos de reglas por pared que atraen los módulos | Regla de alturas solo en Frente |
| Materiales del ambiente | Arrastrar material a piso/pared (Cara/Todo), franjas, regiones; propiedades (escala, rotación, espejado, tono); Copiar material; Cambiar tonalidad; favoritos; búsqueda rápida | Colores fijos |
| Franjas y regiones | Editores de franjas y de regiones (rectángulo, círculo, por puntos, vértices, cortes, offset, chanfle, filete) | No |
| Geometría | Libre, rectangular, circular, poligonal, lineal; propiedades completas; Convertir en panel; Perforar; área húmeda | No |
| Tamponamento | Editor de tamponamentos: tapas y laterales continuos, alineación, offset, inserción automática con prioridad | Tapa por módulo |
| Catálogo | Cocina Gola, Salas, Decore, Lumen, Puertas/Frentes, Puertas extra, Cajas, Composición, favoritos, valores propuestos | Falta todo eso |
| Luces | Editor de luces (ambiente, spot, lineal) | No |
| Armarios a medida | Constructor de armarios, editor de puertas corredizas | Placard corredizo fijo |
| Escaleras | Asistente (recta, helicoidal, con descanso, en U, con relleno) | No |
| Importar | Planta DXF; archivo 3D OBJ/DXF/3DS/SKP como entidad externa | Solo imagen del plano |
| Documentación | Página de impresión, viewports, 6 tipos de cota, capas, texto, imagen, listado | No |
| Preferencias | Fondo, relleno por defecto, paredes, piso, paso de flechas, luces, rebaje; configurar atajos; menú Mostrar | Parcial |

**Distinto hoy:**
- **Cotas manuales:** Promob las hace en el viewport de la página de impresión; en la app se hacen en el 3D. Se agrega la del viewport y se conservan las del 3D.
- **Duplicar:** Promob usa la ventana *Reposicionar*.
- **Editor de paredes:** Promob tiene una ventana 2D propia; la app lo hace en la vista Planta, a la que se suman las herramientas del editor.

## Decisiones y supuestos (a confirmar con fotos del Promob del usuario)

- **Atajos:** se sigue la tabla oficial (U agrupar, Ctrl+U desagrupar, S sustituir). El artículo de agrupar contradice la tabla, porque dice que Ctrl+U agrupa.
- **I "Inverter":** la ayuda no lo describe. Se implementa como espejar el módulo (lado izquierdo ↔ derecho: bisagras, esquineros, cajonera).
- **Menú Vistas:** la ayuda muestra la lista solo en imágenes. Se usa: isométrica derecha (por defecto), isométrica izquierda, isométricas traseras derecha e izquierda, frente, fondo, lateral derecha, lateral izquierda y planta.
- **Sin descripción pública:** *Ítems Extras*, *Organizador de Módulos* y la pestaña *Hacer Gola - Real Scene 2.0*. Quedan al final, a la espera de fotos.
- **Fabricantes y Decore:** no se copian los catálogos de fabricantes (Blum, Bosch, etc.) ni los modelos de Decore. Se hacen modelos paramétricos propios.
- **Importar 3D:** se soportan OBJ, glTF y STL. SKP no, porque el formato es cerrado. DXF se soporta para la planta.

## Rebanadas (issues)

Orden de trabajo: primero lo que se usa todos los días.

| S | Issue | Rebanada | Promob |
|---|---|---|---|
| 1 | #110 | Selección múltiple en el 3D (Ctrl+clic, Ctrl+T, recuadro) y acciones en grupo (mover, rotar, borrar, ocultar) | Selecionar tudo, Ctrl+clic |
| 2 | #111 | Agrupar / Desagrupar (U, Ctrl+U, menú contextual); el grupo se selecciona y mueve como uno | Agrupar e desagrupar |
| 3 | #112 | Copiar, Cortar, Pegar (Ctrl+C/X/V); Duplicar (Ctrl+D) con ventana *Reposicionar* y desplazamiento recordado | Duplicar, atalhos |
| 4 | #113 | Sustitución rápida (S, Ctrl+Shift+K) y Ubicar en el catálogo (Ctrl+Shift+L) | Substituição rápida |
| 5 | #114 | Movimiento: Ctrl+flechas hasta el extremo, Ctrl+Inicio centrar, Shift+mouse rotar, I invertir (espejar) | Atalhos, Rotacionar |
| 6 | #115 | Menú Vistas (isométricas, frente, fondo, laterales, planta), volver/avanzar (20), F8, doble clic en pared → frontal, en piso → planta | Tipos de vistas |
| 7 | #116 | Zoom total (F6), zoom entidad (F5/F7), zoom ventana (W), Pan (P), Zoom (Z), Caminar (C) | Movimentação 3D |
| 8 | #117 | Modos de relleno (F10): texturas con líneas, texturas, relleno con líneas, relleno, oculto, oculto B/N, sin relleno, caja de contorno, presentación | Modos de preenchimento |
| 9 | #118 | Materiales de paredes y piso: barra de materiales del ambiente, arrastrar (Cara/Todo), propiedades (escala, rotación, espejado, tono), Copiar material, Cambiar tonalidad, favoritos, búsqueda | Materiais |
| 10 | #119 | Franjas en paredes (editor horizontal/vertical, guardar configuraciones) y regiones en paredes/piso (rectángulo, círculo, puntos, vértices, cortes, offset, chanfle, filete) con material | Faixas, Regiões |
| 11 | #120 | Ítems lineales sobre varios módulos (tapa, estante, zócalo arrastrados sobre módulos, "¿ajustar?") y Editor de tamponamentos (registrar, alineación, offset, profundidad, inserción automática con prioridad) | Inserir módulo (lineares), Tamponamento |
| 12 | #121 | Geometría: libre, rectangular, circular, poligonal, lineal (con precisión y Tab), propiedades, flechas; Convertir en panel | Construir geometria, Converter |
| 13 | #122 | Perforar: geometría o módulo que perfora pared, piso, geometría o tapa; profundidad; área húmeda | Furar, Área molhada |
| 14 | #123 | Línea Gola: módulos con perfil gola encastrado (altura configurable), frentes sin tirador, holguras propias | Biblioteca Cava/Gola |
| 15 | #124 | Biblioteca Salas (rack de TV, biblioteca, aparador, vajillero, panel de TV) y familias Puertas/Frentes, Puertas extra, Cajas, Composición | Barra de modulação |
| 16 | #125 | Decore: decoración paramétrica propia (mesas, sillas, banquetas, plantas, cuadros, utensilios, alfombras) con aplicación de materiales a Decore (solo este, todos de este tipo, a elección) | Decore |
| 17 | #126 | Lumen y Editor de luces: luz ambiente, spot (apertura, falloff, inclinación) y lineal LED; se usan en el render | Editor de luzes |
| 18 | #127 | Paredes curvas (Flecha, ángulo del arco) y Mover hotpoint (H) | Paredes curvas |
| 19 | #128 | Editor de paredes: Encuentro canto/T, 30-40-50, Bloquear ángulo, construir con referencia, extremos, tipo (normal/Dry Wall) | Paredes |
| 20 | #129 | Piso: ajustar límites, forma por vértices, flechas, piso padrón, cortar piso al terminar, grilla del piso con atracción | Piso |
| 21 | #130 | Réguas: grupos de reglas por pared, Atraer y Gap, editar grupos, menú contextual | Réguas |
| 22 | #131 | Inserción: orientación (Horizontal, Vertical, Horizontal/Vertical en el plano), dirección de inserción, cambiar de plano (clic derecho al arrastrar), Desasociar, mostrar planos | Inserir módulo, Plano de inserção |
| 23 | #132 | Módulos favoritos (asistente: nombre, descripción, imagen, agregados modificados, grupo), exportar/importar | Módulos favoritos |
| 24 | #133 | Dimensiones: +/- en los campos, Escalar proporcional, Valores propuestos, Dimensión máxima "Ambas" | Alterar dimensões |
| 25 | #134 | Vista dinámica (observador, objetivo, línea de corte, guardar vistas para render e impresión) | Vista dinâmica |
| 26 | #135 | Página de impresión: hojas, viewports (vista, ortogonal, escala, altura de corte, relleno, bloquear), texto con campos del cliente, imagen, imprimir/PDF | Página de impressão, Viewport |
| 27 | #136 | Cotas del viewport: lineal, alineada, angular, radio, continua, rápida, automática; propiedades (texto, prefijo, sufijo, flechas); condiciones de cotado | Cotas do projeto |
| 28 | #137 | Capas (paredes, piso, aberturas, módulos, decore, geometrías): visibilidad, relleno, línea; Listado en la hoja (columnas, repeticiones) | Camadas, Listagem |
| 29 | #138 | Constructor de armarios: estructura, vanos, divisiones (móvil/fija, con y sin recuo), cajones, interiores, puertas | Construtor de armários |
| 30 | #139 | Editor de puertas corredizas: número, transpasse, holgura, afastamiento, rieles, laterales, cierres, invertir | Portas deslizantes |
| 31 | #140 | Escaleras: asistente recta, helicoidal, con descanso, en U, con relleno; vigas, pasamanos, columnas, barrotes | Construir escadas |
| 32 | #141 | Importar planta DXF (líneas, arcos, círculos, polilíneas; capas; escala) e importar 3D (OBJ, glTF, STL) como entidad externa | Importar planta baixa, Importar arquivo 3D |
| 33 | #142 | Preferencias (fondo, relleno por defecto, paredes, piso, paso de flechas, luces, rebaje) y Configurar atajos; menú Mostrar (planos, flechas, hotpoints, posición de inserción, grilla y reglas, módulos invisibles) | Preferências, Mostrar |
| 34 | #143 | Pendientes de confirmar con fotos: Ítems Extras, Organizador de Módulos, Hacer Gola | Interface |

Cada rebanada lleva su lógica en `src/domain/` con tests y su escenario en `e2e/run.mjs`. Se mergea cuando pasan `npm test` y el e2e.
