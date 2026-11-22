# Plan de implementación — Fase 5: agregados, inserción automática, aperturas y tiradores

Implementa los requisitos 5.1–5.4 de `docs/PRD.md` (5.5 Serie queda fuera). Rebanadas verticales con tests de dominio (`npm test`) y su paso en `e2e/run.mjs`.

## Referencia funcional (Promob)

De las fotos 02, 03 y 08 (fuera del repo) y de la ayuda pública (`suporte.promob.com`: "Inserir agregados no módulo", "Abertura de portas e gavetas", "Como posicionar puxador do módulo", "Como inserir pés no módulo", "Como inserir e construir rodapé"):

- **Agregados**: ítems opcionales asociados a un módulo (pies, zócalos, tapas, marcos, cornisas, cajones internos…). En *Herramientas · Agregados* se selecciona el módulo, se **tilda** el agregado y el **(+)** muestra sus opciones (cantidad). Destildar lo quita. Entran al presupuesto.
- **Inserción Automática** (pestaña vertical a la izquierda, foto 08): pestañas **Inserción** (lo tildado se agrega a cada módulo que se inserte) y **Ambiente** (sobre los módulos que ya están, con **Aplicar solamente en los ítems seleccionados**); botones **Insertar / Remover**; listas por categoría (**Cocinas**: Pies, Zócalos, Tapas, Cierre para Tapas, Marco para Superior, Cornisas, Vistas, Corredera Común, Bisagra Común; **Dormitorios**: Fondos, Zócalos, Zócalos Traseros, Pies, Ruedas, Tapas, Marcos, Cornisas…; **Baños**).
- **Aperturas** (*Herramientas · Aperturas*, fotos 02/03): Abrir, Cerrar, Abrir todos, Cerrar todos, **Abrir cascada** (cajones escalonados), **Invertir seleccionado** (lado de la bisagra); un diagrama del frente con los cajones y puertas del módulo.
- **Posición del Tirador** (*Herramientas · Posición del Tirador*): presets de posición sobre un diagrama del frente; se aplica al módulo seleccionado o a todos.

## Decisiones de diseño

### D1. Agregados (`src/domain/aggregates.js`)
- `module.aggs = { [tipo]: { qty?, side? } }` (ausente = sin ese agregado). Catálogo `AGG_TYPES` con nombre, categoría, opciones y precio vía herrajes/accesorios.
- Dos clases: los que **cambian parámetros** antes de construir (estantes → `shelves`, divisiones → `dividers`, fondos → tipo de fondo, base: zócalo / zócalo trasero / pies / ruedas → reemplazan la regla *Base* del proyecto para ese módulo) y los que **suman piezas** después (tapa superior, cierre de tapa, marco superior, cornisa, vistas laterales, barral, cajones internos). Todos pasan por el mismo despiece y presupuesto.

### D2. Inserción automática
- `project.autoInsert = { [categoría]: [tipos] }` para lo que se agrega al insertar; *Ambiente* aplica o quita en los módulos existentes de esa categoría (o solo en los seleccionados). Corredera / Bisagra común eligen el modelo de ese accesorio en el módulo.

### D3. Aperturas
- El motor marca cada pieza de un frente con `front` (índice) y, en las puertas, `hinge` (`izq`/`der`); `params.hinges` invierte el lado por puerta. El estado abierto/cerrado es de la vista (no se guarda ni va al historial); el 3D gira la puerta sobre su bisagra y saca el cajón con su caja.

### D4. Tirador
- `handlePos` suma `custom` con `handleOffset` (mm desde el borde) y `handleOrient` (vertical / horizontal).

## Rebanadas

| # | Issue | Rebanada | Requisitos |
|---|---|---|---|
| S1 | #81 | Agregados de base y estructura (pies, zócalo, zócalo trasero, ruedas, fondos, estantes, divisiones, barral) + panel Agregados (tecla `A`) | 5.1 |
| S2 | #82 | Agregados de terminación (tapa, cierre de tapa, marco superior, cornisa, vistas, cajones internos) | 5.1 |
| S3 | #83 | Inserción automática (Inserción / Ambiente, por categoría) | 5.2 |
| S4 | #84 | Aperturas: abrir/cerrar, abrir todos, cascada, invertir, diagrama del frente | 5.3 |
| S5 | #85 | Posición del tirador (presets, personalizada en mm, orientación) | 5.4 |
