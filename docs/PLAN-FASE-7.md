# Plan — Fase 7: configuración del render

Epic: #20. Requisitos en [PRD §Fase 7](PRD.md#fase-7--configuración-del-render).

## Cómo lo hace Promob (referencia funcional)

Fuentes: artículos de suporte.promob.com de *Render Up*, *Real Scene* e *IS7*:
- Render Up: dimensão, qualidade, imagem de fundo, marca d'água.
- Render Up: configurações (aba Clima).
- Real Scene: efeitos de render.
- IS7: configuração do render e luz do sol.

- **Calidad**: *Render Rápido* sirve para revisar luces y acabados: textura algo granulada, sombras menos suaves. *Render Final* es la imagen realista. Real Scene agrega *Render Profissional*, con calidad de foto y más tiempo de cálculo.
- **Dimensión**: hay tres opciones de resolución:
  - *Personalizada*: Largura × Altura.
  - *Ambiente 3D*: el tamaño de la vista.
  - *Tamanhos pré-configurados*.

  En IS7 se ve en la pantalla el **área que se va a renderizar**, y hay un artículo para mostrarla u ocultarla.
- **Clima**: hay una lista de presets: luz blanca, nublado, amanecer, neblina, soleado, atardecer. *Não aplicar* renderiza solo con la luz artificial o ambiente. También hay:
  - *Intensidade do Clima*: barra.
  - *Altitude*: ángulo del sol; más baja da luz más oscura.
  - *Azimute*: dirección del sol.
  - *Ativar a luz ambiente padrão*.

  La calidad, la dimensión y el fondo se siguen aplicando aunque el clima esté en *Não aplicar*.
- **Fondo**: hay *Imagem de Fundo* (se abre un archivo) o *Cor de Fundo* con *Cor Principal* y *Cor Gradual*. El fondo se ve solo en la imagen renderizada.
- **Marca de agua**:
  - *Usar marca d'água*: la configuración queda guardada para los próximos renders.
  - *Procurar*: la imagen va a su propio tamaño y no se puede escalar.
  - *Posição*: arranca centrada; un ejemplo es "Inferior esquerda".
  - *Transparência*: un valor más alto la deja menos visible.
  - *Afastamento da borda*: en píxeles, medido desde los dos bordes de la esquina elegida.
- **Panorama 360°**: se activa en la configuración del render. El centro es el punto donde está parado el observador. Se mira dentro de Promob arrastrando con el mouse y se puede compartir como imagen.

No copiamos nada de Promob: solo replicamos el flujo y los nombres genéricos.

## Diseño

- **Dominio** `src/domain/render.js`:
  - `DEFAULT_RENDER` y `normalizeRender`.
  - Calidades configurables: muestras y rebotes.
  - Presets de tamaño y `renderSize`.
  - Ancho y alto con proporción bloqueada.
  - `fitRect`: el área del render dentro de la vista.
  - `renderFov`: hace que la cámara del render encuadre exactamente esa área.
  - `CLIMAS` y `sunDirection(azimut, altitud)`.
  - `watermarkRect`: 9 posiciones más el afastamiento.
  - `backgroundLayout`: imagen en modo *cover*.
- **Dónde se guarda**:
  - Con el proyecto (`project.render`): calidad, tamaño, clima y fondo.
  - En el navegador (`mueblesapp.render.watermark`): la marca de agua. Como en Promob, se reutiliza en todos los renders.
- **Ventana de render**: un `WebGLRenderer` aparte, fuera de pantalla, al tamaño pedido. Usa la misma escena y una copia de la cámara, como las miniaturas del catálogo.
  - *Rápido*: rasterizado con sombras.
  - *Final* y *Profesional*: trazado de rayos (`three-gpu-pathtracer`) con fondo transparente.

  La imagen final se compone en un canvas 2D en este orden: **fondo → render → marca de agua**. Así el fondo es igual en los tres modos y no ilumina la escena, como en Promob.
- El viejo botón *Render final*, que trazaba rayos dentro de la vista, se reemplaza por **Renderizar…** (diálogo → ventana). *Modo render* queda como vista previa en la vista y aplica el clima.

## Rebanadas (issues)

| S | Issue | Requisito | Contenido |
|---|---|---|---|
| S1 | #99 | 7.1 | Diálogo **Configuración del render**: calidad (rápido / final / profesional) y dimensión (Ambiente 3D, presets, personalizada con proporción bloqueable). Área del render en la vista. Ventana de render con progreso, Detener y Guardar imagen (PNG). |
| S2 | #100 | 7.2 | Pestaña **Clima**: presets y *No aplicar*; sol activo; intensidad del sol y del cielo; **azimut** con brújula y **altitud** con arco, arrastrables y editables; luz ambiente. Se aplica en la vista previa y en el render. |
| S3 | #101 | 7.3 | Pestaña **Fondo**: color, degradé (color principal y color gradual, de cielo a horizonte) o imagen (cover). La imagen se achica al cargarla. |
| S4 | #102 | 7.4 | Pestaña **Marca de agua**: usar, imagen, 9 posiciones, transparencia y afastamiento del borde. Se guarda para los próximos renders. Si la imagen no entra en el render, se achica. |
| S5 | #103 | 7.5 | **Render 360°**: panorama equirectangular 2:1 desde la posición de la cámara (rasterizado con CubeCamera o trazado de rayos con EquirectCamera). Visor panorámico arrastrable con zoom y Guardar imagen. |

Fuera de alcance: render con IA; cola de renders; luces artificiales editables (no hay luminarias en la biblioteca); control automático de la suavización de la luz.
