# MueblesApp — guía para Claude Code

- Leer primero `docs/CONTEXTO.md` (objetivo, decisiones, roadmap) y `README.md` (estructura).
- El usuario habla español rioplatense (voseo); responder en ese idioma.
- La lógica va en `src/domain/` (JS puro, sin React) con tests en `tests/`. Cada regla o módulo nuevo lleva test.
- Verificar con `npm test` y, para UI, `npm run e2e` con `npm run dev` corriendo (`HEADFUL=1` para el render final).
- Reglas de construcción: nunca hardcodear "la correcta"; agregarlas a `DEFAULT_RULES`/`RULE_DEFS` para que sean configurables.
- Promob: solo referencia funcional. No descompilar ni copiar su código, bibliotecas o archivos; nada de Promob en el repo (es público).
- Precios: valores de prueba en `src/domain/catalog.js`, editables desde la pestaña Precios.
