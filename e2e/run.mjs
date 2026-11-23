// Prueba end-to-end en Chrome real: clics, arrastres, teclado, pestañas, render.
// Uso: con `npm run dev` corriendo → `npm run e2e`
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const URL = process.env.APP_URL || 'http://localhost:5173/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = new globalThis.URL('./screens/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? '✔' : '✖'} ${name}${info ? ' — ' + info : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: process.env.HEADFUL ? false : true,
  // Sin ventana se usa GPU por software (lento: el render final puede no avanzar). HEADFUL=1 usa la GPU real.
  args: process.env.HEADFUL ? ['--window-size=1440,980'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept()); // confirmaciones de la app (p. ej. "Nuevo")

const project = () => page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.project')));
const shot = (n) => page.screenshot({ path: OUT + n + '.png' });
const clickText = async (sel, text) => {
  const ok = await page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().startsWith(text));
    if (el) el.click();
    return !!el;
  }, sel, text);
  if (!ok) throw new Error(`No encontré "${text}"`);
  await sleep(400);
};
// Catálogo (barra de modulación): navegar biblioteca → familia → subfamilia y doble clic en el ítem.
const PATHS = {
  'Placard batientes': ['Dormitorios', 'Placares', 'Batientes'],
  'Cajonera interior': ['Dormitorios', 'Componentes', 'Cajoneras'],
  'Bajo mesada puertas': ['Cocinas', 'Inferiores', 'Puertas'],
};
const insertFromCatalog = async (label) => {
  const [l, g, sg] = PATHS[label];
  await clickText('.cb-libs .cb-tab', l); await clickText('.cb-groups .cb-tab', g); await clickText('.cb-subs .cb-tab', sg);
  const ok = await page.evaluate((label) => {
    const b = [...document.querySelectorAll('.mod-btn')].find((e) => e.querySelector('span')?.textContent.trim() === label);
    if (b) b.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return !!b;
  }, label);
  if (!ok) throw new Error('No encontré ' + label + ' en el catálogo');
  await sleep(400);
};
const fieldInput = (label) => page.evaluateHandle((label) => {
  const f = [...document.querySelectorAll('.inspector label.field')].find((l) => l.querySelector('span')?.textContent.trim() === label);
  return f?.querySelector('input,select');
}, label);

try {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2500);
  await shot('01-inicio');
  check('Carga sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('Canvas 3D presente', !!(await page.$('canvas')));
  let p = await project();
  check('Proyecto de ejemplo cargado', p.modules.length === 7, `${p.modules.length} módulos`);

  // Agregar módulo desde catálogo
  await insertFromCatalog('Placard batientes');
  p = await project();
  check('Agregar módulo desde catálogo', p.modules.length === 8);
  const placard = p.modules.at(-1);
  check('Módulo nuevo queda seleccionado', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Placard batientes');

  // Editar medida en inspector
  const w = await fieldInput('Ancho');
  await w.click({ count: 3 });
  await w.type('1500');
  await page.keyboard.press('Enter');
  await sleep(400);
  p = await project();
  check('Editar ancho desde inspector', p.modules.find((m) => m.id === placard.id).params.width === 1500);
  // Barra de catálogo en 3 niveles (#55)
  check('Catálogo arriba del visor en 3 niveles', !!(await page.$('.viewport > .catalog-bar')) && (await page.$$('.cb-libs .cb-tab')).length >= 5 && !!(await page.$('.cb-groups .cb-tab.on')) && !!(await page.$('.cb-subs .cb-tab.on')));
  await clickText('.cb-libs .cb-tab', 'Cocinas');
  await clickText('.cb-libs .cb-tab', '★ Más usados');
  const usados = await page.$$eval('.mod-btn span', (els) => els.map((e) => e.textContent.trim()));
  check('Más usados muestra lo que se insertó', usados.includes('Placard batientes'), usados.join(', '));
  await clickText('.cb-subs .cb-nav', '⟵');
  check('Atrás vuelve a la biblioteca anterior', (await page.$eval('.cb-libs .cb-tab.on', (e) => e.textContent.trim())) === 'Cocinas');
  await sleep(800);
  const thumbs = await page.$$eval('.mod-btn img.cb-thumb', (els) => els.map((e) => e.src.length));
  check('Miniaturas generadas del modelo 3D', thumbs.length > 0 && thumbs.every((n) => n > 3000), `${thumbs.length} miniaturas, ${thumbs.join('/')} bytes`);
  await shot('01b-catalogo');
  // Desplegable de variantes de medida (#57)
  await clickText('.cb-libs .cb-tab', 'Cocinas'); await clickText('.cb-groups .cb-tab', 'Inferiores'); await clickText('.cb-subs .cb-tab', 'Cajoneros');
  await page.select('.mod-btn .cb-variant', '450'); await sleep(900);
  const nBefore = (await project()).modules.length;
  await page.evaluate(() => document.querySelector('.mod-btn').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await sleep(500);
  p = await project();
  const added = p.modules.at(-1);
  check('Variante de medida: inserta el cajonero de 450', p.modules.length === nBefore + 1 && added.type === 'bajo_cajones' && added.params.width === 450, 'ancho ' + added.params.width);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(400);
  p = await project();
  check('Deshacer saca el módulo insertado', p.modules.length === nBefore);
  // Insertar arrastrando desde el catálogo con recuadro verde (#58)
  const dropAt = await page.evaluate(() => window.__muebles.screenOfPoint(3300, 250, 0));
  const drag = (type) => page.evaluate((type, x, y) => {
    const src = [...document.querySelectorAll('.mod-btn')].find((e) => e.querySelector('span')?.textContent.trim() === 'Bajo mesada cajonero');
    const vp = document.querySelector('.vp-area');
    window.__dt = window.__dt || new DataTransfer();
    const ev = (t, el) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: window.__dt }));
    if (type === 'start') { ev('dragstart', src); ev('dragenter', vp); ev('dragover', vp); }
    if (type === 'drop') { ev('drop', vp); ev('dragend', src); window.__dt = null; }
  }, type, dropAt.x, dropAt.y);
  await drag('start'); await sleep(600);
  check('Arrastrar desde el catálogo muestra el recuadro verde', await page.evaluate(() => window.__muebles.ghostShown));
  await shot('01c-recuadro-verde');
  await drag('drop'); await sleep(600);
  p = await project();
  const dropped = p.modules.at(-1);
  check('Al soltar inserta contra la pared del fondo', p.modules.length === nBefore + 1 && dropped.type === 'bajo_cajones' && dropped.z === 0 && dropped.rot === 0 && !(await page.evaluate(() => window.__muebles.ghostShown)), '(' + dropped.x + ',' + dropped.z + ') rot ' + dropped.rot);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(400);
  check('Deshacer saca el módulo arrastrado', (await project()).modules.length === nBefore);
  // Módulos nuevos (#61): torre p/ horno y tapa p/ 2 bachas desde el catálogo
  const dbl = (label) => page.evaluate((label) => {
    const b = [...document.querySelectorAll('.mod-btn')].find((e) => e.querySelector('span')?.textContent.trim() === label);
    if (b) b.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return !!b;
  }, label);
  await clickText('.cb-libs .cb-tab', 'Cocinas'); await clickText('.cb-groups .cb-tab', 'Altos'); await clickText('.cb-subs .cb-tab', 'Módulos p/Electrodomésticos');
  const okTorre = await dbl('Torre p/ horno y microondas'); await sleep(500);
  await clickText('.cb-groups .cb-tab', 'Tapas/Estantes'); await clickText('.cb-subs .cb-tab', 'Tapas');
  const tapas = await page.$$eval('.mod-btn span', (els) => els.map((e) => e.textContent.trim()));
  const okTapa = await dbl('Tapa p/ 2 bachas'); await sleep(500);
  p = await project();
  const [torre, tapa] = p.modules.slice(-2);
  check('Catálogo con módulos nuevos (torre p/ horno, tapas con bachas)', okTorre && okTapa && torre.type === 'torre_horno' && tapa.type === 'tapa' && tapa.params.bachas === 2 && tapas.length === 3, tapas.join(', '));
  await shot('01f-modulos-nuevos');
  check('El módulo toma el nombre del ítem', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Tapa p/ 2 bachas');
  // Esquineros L y oblicuos (#62)
  await clickText('.cb-groups .cb-tab', 'Inferiores'); await clickText('.cb-subs .cb-tab', 'Esquineros');
  const esq = await page.$$eval('.mod-btn span', (els) => els.map((e) => e.textContent.trim()));
  await clickText('.cb-subs .cb-tab', 'Módulos Diagonales');
  const okObl = await dbl('Esquinero oblicuo 2P 900mm'); await sleep(500);
  p = await project();
  check('Esquineros L (4) y oblicuos en el catálogo', esq.length === 4 && okObl && p.modules.at(-1).type === 'esq_oblicuo' && p.modules.at(-1).params.doors === 2, esq.join(', '));
  await shot('01g-esquinero');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
  for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300); }
  check('Deshacer saca los módulos nuevos', (await project()).modules.length === nBefore);
  // Electrodomésticos · Cocción (#91): cocina y anafe, precio opcional al presupuesto
  {
    await clickText('.cb-libs .cb-tab', 'Electrodomésticos'); await clickText('.cb-groups .cb-tab', 'Cocción'); await clickText('.cb-subs .cb-tab', 'Cocinas');
    const cocinas = await page.$$eval('.mod-btn span', (els) => els.map((e) => e.textContent.trim()));
    await dbl('Cocina 56 cm'); await sleep(500);
    await clickText('.cb-subs .cb-tab', 'Anafes'); await dbl('Anafe 60 cm 4 hornallas'); await sleep(500);
    p = await project();
    const [coc, ana] = p.modules.slice(-2);
    check('Electrodomésticos: cocinas 50/56/60/76/90 y anafe que se apoya', cocinas.length === 5 && coc.type === 'cocina' && coc.params.width === 560 && ana.type === 'anafe' && ana.rest === true, cocinas.join(', '));
    await shot('01i-cocina-anafe');
    await clickText('.tabs button', 'Plan de corte'); await sleep(400);
    const anyCocina = await page.$$eval('.page table tbody tr', (rs) => rs.some((r) => r.textContent.includes('Cocina')));
    check('Los electrodomésticos no entran al despiece', !anyCocina);
    await clickText('.tabs button', 'Diseño 3D'); await sleep(400);
    await page.keyboard.press('Escape'); await sleep(200);
    const cp = await page.evaluate((id) => window.__muebles.screenOf(id, 100), coc.id);
    await page.mouse.click(cp.x, cp.y); await sleep(400);
    await page.keyboard.press('KeyE'); await sleep(200);
    const priceIn = await fieldInput('Precio (opcional, al presupuesto)');
    if (priceIn) { await priceIn.click({ count: 3 }); await priceIn.type('450000'); await page.keyboard.press('Enter'); await sleep(400); }
    await clickText('.tabs button', 'Presupuesto'); await sleep(400);
    const el = await page.$$eval('.page table tbody tr', (rs) => rs.map((r) => r.textContent));
    check('Con precio, la cocina va al presupuesto', el.some((t) => t.includes('Cocina 56 cm') && t.includes('450.000')), el.filter((t) => t.includes('Cocina')).join(' | '));
    await clickText('.tabs button', 'Diseño 3D'); await sleep(400);
    for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300); }
    check('Deshacer saca los electrodomésticos', (await project()).modules.length === nBefore);
    // Refrigeración, microondas y lavado (#92)
    await clickText('.cb-libs .cb-tab', 'Electrodomésticos');
    await clickText('.cb-groups .cb-tab', 'Refrigeración'); await dbl('Heladera side by side'); await sleep(400);
    await clickText('.cb-groups .cb-tab', 'Lavado'); await clickText('.cb-subs .cb-tab', 'Lavarropas'); await dbl('Lavarropas carga frontal'); await sleep(400);
    await clickText('.cb-groups .cb-tab', 'Microondas'); await dbl('Microondas empotrable'); await sleep(400);
    await clickText('.cb-groups .cb-tab', 'Cocción'); await clickText('.cb-subs .cb-tab', 'Cocinas'); await dbl('Cocina 60 cm'); await sleep(400);
    p = await project();
    const [hel, lav, mic, coc2] = p.modules.slice(-4);
    check('Heladera side by side, lavarropas y microondas empotrable', hel.type === 'heladera' && hel.params.tipo === 'side' && hel.params.width === 912 && lav.type === 'lavarropas' && mic.type === 'microondas' && mic.y === 1450 && !mic.rest && coc2.type === 'cocina', JSON.stringify([hel.params.tipo, mic.y, mic.rest]));
    await clickText('.vp-toolbar button', 'Frente'); await sleep(900);
    await shot('01j-electrodomesticos');
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(600);
    for (let i = 0; i < 4; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300); }
    check('Deshacer saca heladera, lavarropas, microondas y cocina', (await project()).modules.length === nBefore);
    // Bachas y calado de la mesada (#93): bacha simple sobre el bajo bacha → la mesada queda calada
    const bb = (await project()).modules.find((m) => m.type === 'bajo_bacha');
    await clickText('.cb-libs .cb-tab', 'Accesorios'); await clickText('.cb-groups .cb-tab', 'Bachas'); await clickText('.cb-subs .cb-tab', 'De apoyo');
    await dbl('Bacha simple con escurridor'); await sleep(400);
    await page.keyboard.press('KeyE'); await sleep(200);
    const setF = async (label, v) => { const f = await fieldInput(label); await f.click({ count: 3 }); await f.type(String(v)); await page.keyboard.press('Enter'); await sleep(250); };
    await setF('X (desde pared izq.)', bb.x + 45); await setF('Z (desde pared fondo)', bb.z + 40);
    const apo = () => page.evaluate(() => [...document.querySelectorAll('.inspector label.check-row')].find((l) => l.textContent.includes('Apoyar')).querySelector('input').click());
    await apo(); await sleep(250); await apo(); await sleep(400);
    p = await project();
    const sink = p.modules.at(-1);
    check('La bacha se apoya arriba de la mesada del bajo', sink.type === 'bacha' && sink.y === bb.params.height + bb.params.mesadaT, 'y=' + sink.y);
    await clickText('.cb-groups .cb-tab', 'Griferías'); await dbl('Monocomando caño alto'); await sleep(300);
    await setF('X (desde pared izq.)', bb.x + 370); await setF('Z (desde pared fondo)', bb.z + 10);
    await apo(); await sleep(250); await apo(); await sleep(400);
    await shot('01k-bacha-calada');
    await clickText('.tabs button', 'Presupuesto'); await sleep(400);
    const cal = await page.$$eval('.page table tbody tr', (rs) => rs.map((r) => r.textContent).filter((t) => t.includes('Calado de mesada')));
    check('El calado de la mesada va al presupuesto', cal.length === 1 && cal[0].includes('1u'), cal.join(' | '));
    await clickText('.tabs button', 'Diseño 3D'); await sleep(400);
    for (let i = 0; i < 10; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    check('Deshacer saca la bacha y la grifería', (await project()).modules.length === nBefore);
    // Sanitarios de baño (#94)
    await clickText('.cb-libs .cb-tab', 'Baños'); await clickText('.cb-groups .cb-tab', 'Sanitarios');
    await clickText('.cb-subs .cb-tab', 'Inodoros y bidets'); await dbl('Inodoro con mochila'); await sleep(300); await dbl('Bidet'); await sleep(300);
    await clickText('.cb-subs .cb-tab', 'Lavatorios'); await dbl('Lavatorio con pie'); await sleep(300);
    p = await project();
    const san = p.modules.slice(-3).map((m) => m.type);
    check('Sanitarios: inodoro, bidet y lavatorio con pie', JSON.stringify(san) === '["inodoro","bidet","lavatorio"]', san.join(','));
    await shot('01l-sanitarios');
    for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
    await page.keyboard.press('Escape'); await sleep(200);
  }
  // Lista de Módulos (#60)
  await clickText('.side-tab', 'Lista de Módulos');
  const planes = await page.$$eval('.ml-plane-btn', (els) => els.map((e) => e.textContent.trim()));
  const rows = await page.$$eval('.ml-row span', (els) => els.length);
  check('Lista de Módulos por plano de inserción', !!(await page.$('.module-list')) && planes.some((t) => t.startsWith('⊟ Pared 1')) && rows === nBefore, planes.join(' | ') + ' · ' + rows + ' filas');
  await shot('01e-lista-modulos');
  const firstId = (await project()).modules[0].id;
  await page.click('.ml-row .ml-bulb'); await sleep(400);
  p = await project();
  const hid = p.modules.filter((m) => m.hidden).length;
  check('La lamparita oculta el módulo', hid === 1 && (await page.$$('.ml-row.off')).length === 1);
  await page.click('.ml-row .ml-bulb'); await sleep(300);
  await clickText('.ml-row span', 'M1 ·');
  await page.keyboard.press('KeyO'); await sleep(300);
  check('Tecla O oculta el seleccionado', (await project()).modules.find((m) => m.id === firstId)?.hidden === true);
  await page.keyboard.press('KeyO'); await sleep(300);
  const m2 = await page.evaluateHandle(() => [...document.querySelectorAll('.ml-row span')].find((e) => e.textContent.startsWith('M2 ·')));
  await page.keyboard.down('Control'); await m2.click(); await page.keyboard.up('Control'); await sleep(300);
  await clickText('.ml-actions button', 'Remover');
  p = await project();
  check('Ctrl+clic y Remover borra varios', p.modules.length === nBefore - 2, p.modules.length + ' módulos');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(400);
  p = await project();
  check('Deshacer devuelve los módulos removidos', p.modules.length === nBefore && p.modules.every((m) => !m.hidden));
  await clickText('.side-tab', 'Lista de Módulos');
  await page.keyboard.press('Escape'); await sleep(200);
  // Inserción Automática (#83): Inserción (al insertar) y Ambiente (sobre los existentes)
  await clickText('.side-tab', 'Inserción Automática');
  const aiTick = (cat, label) => page.evaluate((cat, label) => {
    const c = [...document.querySelectorAll('.ai-cat')].find((e) => e.querySelector('.ml-plane-btn').textContent.includes(cat));
    [...c.querySelectorAll('.ai-item')].find((l) => l.textContent.trim() === label).querySelector('input').click();
  }, cat, label);
  await aiTick('Cocinas', 'Tapas'); await sleep(300);
  p = await project();
  check('Inserción: lo tildado queda guardado en el proyecto', JSON.stringify(p.autoInsert?.Cocinas) === '["tapas"]');
  await insertFromCatalog('Bajo mesada puertas');
  p = await project();
  check('Un módulo insertado sale con lo tildado (tapa)', !!p.modules.at(-1).aggs?.tapa);
  for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300); }
  await clickText('.auto-insert .mv-tabs button', 'Ambiente');
  await aiTick('Cocinas', 'Marco para Superior'); await sleep(200);
  await clickText('.auto-insert .ai-btns button', '⇨ Insertar');
  p = await project();
  const altas = p.modules.filter((m) => (m.y || 0) >= 1000 && m.type.startsWith('alacena'));
  check('Ambiente · Insertar: marco en todos los superiores de cocina', altas.length > 0 && altas.every((m) => m.aggs?.marco) && p.modules.filter((m) => (m.y || 0) < 1000).every((m) => !m.aggs?.marco));
  await shot('01h-insercion-automatica');
  await clickText('.auto-insert .ai-btns button', '✕ Remover');
  p = await project();
  check('Ambiente · Remover lo saca', p.modules.every((m) => !m.aggs?.marco));
  await clickText('.side-tab', 'Inserción Automática');
  // Localizar Rápido (#59)
  await page.keyboard.down('Control'); await page.keyboard.press('KeyL'); await page.keyboard.up('Control'); await sleep(400);
  check('Ctrl+L abre Localizar Rápido', !!(await page.$('.quickfind')));
  await page.type('.qf-search input', 'cajonera'); await page.keyboard.press('Enter'); await sleep(400);
  const folders = await page.$$eval('.qf-folder', (els) => els.map((e) => e.textContent));
  const foot = await page.$eval('.qf-foot', (e) => e.textContent);
  check('Resultados agrupados por ruta con el total', folders.some((f) => f.includes('Dormitorios\\Componentes\\Cajoneras\\')) && /Se encontraron \d+ ítems/.test(foot), folders.join(' | ') + ' · ' + foot);
  await shot('01d-localizar');
  await clickText('.qf-item span', 'Cajonera interior');
  const onLib = await page.$eval('.cb-libs .cb-tab.on', (e) => e.textContent.trim());
  const pickedLbl = await page.$eval('.mod-btn.picked span', (e) => e.textContent.trim()).catch(() => '');
  check('Clic en un resultado lo muestra en la barra', onLib === 'Dormitorios' && pickedLbl === 'Cajonera interior', onLib + ' / ' + pickedLbl);
  await page.evaluate(() => [...document.querySelectorAll('.qf-item')].find((e) => e.textContent.includes('Cajonera interior')).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await sleep(500);
  p = await project();
  check('Doble clic en un resultado lo inserta y cierra', p.modules.length === nBefore + 1 && p.modules.at(-1).type === 'cajonera_placard' && !(await page.$('.quickfind')));
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(400);

  // Seleccionar un bajo mesada con clic en 3D y arrastrarlo
  await page.keyboard.press('Escape');
  const target = p.modules.find((m) => m.type === 'bajo_mixto');
  const before = { x: target.x, z: target.z };
  const pt = await page.evaluate((id) => window.__muebles.screenOf(id, 100), target.id);
  check('Sonda 3D disponible', !!pt);
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(pt.x - 12 * i, pt.y + 14 * i); await sleep(30); }
  await page.mouse.up();
  await sleep(500);
  p = await project();
  const after = p.modules.find((m) => m.id === target.id);
  check('Clic en 3D selecciona módulo', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Bajo mesada cajón + puertas');
  check('Arrastrar módulo lo mueve', after.x !== before.x || after.z !== before.z, `(${before.x},${before.z}) → (${after.x},${after.z})`);
  await shot('02-arrastre');

  // Deshacer/rehacer: el arrastre completo es un solo paso
  const ctrl = async (key) => { await page.keyboard.down('Control'); await page.keyboard.press(key); await page.keyboard.up('Control'); await sleep(400); };
  await ctrl('KeyZ');
  p = await project();
  const undone = p.modules.find((m) => m.id === target.id);
  check('Ctrl+Z deshace el arrastre entero', undone.x === before.x && undone.z === before.z, `(${undone.x},${undone.z})`);
  await ctrl('KeyY');
  p = await project();
  const redone = p.modules.find((m) => m.id === target.id);
  check('Ctrl+Y rehace el arrastre', redone.x === after.x && redone.z === after.z, `(${redone.x},${redone.z})`);

  // Teclado
  await page.keyboard.press('KeyR'); await sleep(300);
  p = await project();
  check('Tecla R rota 90°', p.modules.find((m) => m.id === target.id).rot === 90);
  const x0 = p.modules.find((m) => m.id === target.id).z;
  await page.keyboard.press('ArrowDown'); await sleep(300);
  p = await project();
  check('Flecha mueve 10mm', p.modules.find((m) => m.id === target.id).z === Math.min(x0 + 10, p.room.d - p.modules.find((m) => m.id === target.id).params.width));
  await clickText('.row-btns button', 'Duplicar'); await sleep(300);
  check('Duplicar abre la ventana Reposicionar (Fase 7b S3)', !!(await page.$('.reposicionar')));
  await clickText('.reposicionar button', 'Aceptar'); await sleep(300);
  p = await project();
  check('Duplicar módulo', p.modules.length === 9);
  const orig = p.modules.find((m) => m.id === target.id), cp1 = p.modules.at(-1);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyD'); await page.keyboard.up('Control'); await sleep(300);
  p = await project();
  const cp2 = p.modules.at(-1);
  check('Ctrl+D repite el mismo desplazamiento sin preguntar', p.modules.length === 10 && !(await page.$('.reposicionar')) && cp2.x - cp1.x === cp1.x - orig.x && cp2.z - cp1.z === cp1.z - orig.z, `${orig.x}→${cp1.x}→${cp2.x}`);
  for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
  const tp = await page.evaluate((id) => window.__muebles.screenOf(id, 100), target.id);
  await page.mouse.click(tp.x, tp.y); await sleep(300);
  await clickText('.row-btns button', 'Duplicar'); await sleep(300); // ya no pregunta
  await page.keyboard.press('Delete'); await sleep(300);
  p = await project();
  check('Supr borra módulo', p.modules.length === 8);

  // Colisión, Acoplamientos y arrastre que no se pierde (#39)
  const modNow = async (id) => (await project()).modules.find((m) => m.id === id);
  const dragBy = async (id, dx, dy, n = 30) => {
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), id);
    await page.mouse.move(q.x, q.y); await page.mouse.down();
    for (let i = 1; i <= n; i++) { await page.mouse.move(q.x + dx * i, q.y + dy * i); await sleep(30); }
    await page.mouse.up(); await sleep(400);
  };
  const toggleOn = (label) => page.evaluate((label) => [...document.querySelectorAll('.statusbar .sb-toggle')].find((b) => b.textContent.trim() === label)?.classList.contains('on'), label);
  const fwOf = (m) => (m.rot % 180 ? m.params.depth : m.params.width);
  check('Colisión y Acoplamientos activos por defecto en la barra inferior', (await toggleOn('Colisión')) && (await toggleOn('Acoplamientos')) && (await toggleOn('Auto Rebajar')));
  await dragBy(target.id, 30, 0);
  let cmod = await modNow(target.id);
  check('Con Colisión el módulo frena contra la pared derecha', cmod.x + fwOf(cmod) <= 3600, `x=${cmod.x}, ancho en planta ${fwOf(cmod)}`);
  await dragBy(target.id, 0, -25);
  cmod = await modNow(target.id);
  check('Arrastrar hacia el fondo no lo saca del ambiente', cmod.z >= 0 && cmod.x + fwOf(cmod) <= 3600 && cmod.x >= 0, `(${cmod.x},${cmod.z})`);
  await shot('03-colision');
  await page.keyboard.press('KeyB'); await sleep(300);
  check('Tecla B apaga la Colisión', (await toggleOn('Colisión')) === false);
  await dragBy(target.id, 30, 0);
  cmod = await modNow(target.id);
  check('Sin Colisión el módulo atraviesa la pared', cmod.x + fwOf(cmod) > 3600, `x=${cmod.x}`);
  await ctrl('KeyZ'); await ctrl('KeyZ'); await ctrl('KeyZ');
  await page.keyboard.press('KeyB'); await sleep(300);
  check('Tecla B vuelve a prender la Colisión', await toggleOn('Colisión'));
  await clickText('.statusbar .sb-toggle', 'Acoplamientos');
  check('Acoplamientos se apaga desde la barra', (await toggleOn('Acoplamientos')) === false);
  await clickText('.statusbar .sb-toggle', 'Acoplamientos');
  p = await project();
  check('Deshacer devuelve el módulo adentro', p.modules.length === 8 && (() => { const m = p.modules.find((o) => o.id === target.id); return m.x + fwOf(m) <= 3600; })());

  // Panel Herramientas · Movimiento (#41)
  {
    const sel = await page.evaluate((id) => window.__muebles.screenOf(id, 100), target.id);
    await page.mouse.click(sel.x, sel.y); await sleep(500);
    const m0 = await modNow(target.id);
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyM');
    await page.keyboard.up('Shift'); await page.keyboard.up('Control'); await sleep(400);
    const onTool = () => page.$eval('.tools-item.on', (e) => e.textContent.trim());
    check('Ctrl+Shift+M abre Herramientas · Movimiento', (await onTool()).endsWith('Movimiento') && !!(await page.$('.movement')));
    await shot('03b-movimiento');
    const press = async (label) => { await page.click(`.mv-arrow[aria-label="${label}"]`); await sleep(300); };
    await press('Ancho +');
    let mm = await modNow(target.id);
    check('Ancho + mueve 10 mm sobre el eje del módulo', Math.abs(mm.x - m0.x) + Math.abs(mm.z - m0.z) === 10, `(${m0.x},${m0.z}) → (${mm.x},${mm.z}) rot ${m0.rot}`);
    const stepIn = await page.$('.mv-step input');
    await stepIn.click({ count: 3 }); await stepIn.type('100'); await page.keyboard.press('Enter'); await sleep(300);
    await press('Alto +');
    mm = await modNow(target.id);
    check('Con paso 100, Alto + sube el módulo 100 mm', (mm.y || 0) === (m0.y || 0) + 100, `y=${mm.y}`);
    await page.keyboard.press('PageDown'); await sleep(300);
    mm = await modNow(target.id);
    check('AvPág baja 10 mm', mm.y === (m0.y || 0) + 90, `y=${mm.y}`);
    await clickText('.mv-tabs button', 'Rotación');
    const r0 = mm.rot;
    await press('Alto +');
    mm = await modNow(target.id);
    check('Rotación + gira 90° sobre el centro', mm.rot === (r0 + 90) % 360, `rot ${r0} → ${mm.rot}`);
    await clickText('.mv-tabs button', 'Desplazamiento');
    await page.keyboard.press('KeyX'); await sleep(200);
    check('Tecla X traba el movimiento en X', ((await page.$eval('.sb-lock', (e) => e.textContent).catch(() => '')) || '').includes('ancho'));
    const mz = mm.z;
    await dragBy(target.id, -10, 12, 15);
    mm = await modNow(target.id);
    check('Con la traba, arrastrar no cambia la profundidad', mm.z === mz, `z ${mz} → ${mm.z}, x=${mm.x}`);
    await page.keyboard.press('KeyX'); await sleep(200);
    check('X de nuevo quita la traba', !(await page.$('.sb-lock')));
    for (let i = 0; i < 5; i++) await ctrl('KeyZ');
    mm = await modNow(target.id);
    check('Deshacer vuelve el módulo a donde estaba', mm.x === m0.x && mm.z === m0.z && (mm.y || 0) === (m0.y || 0) && mm.rot === m0.rot, `(${mm.x},${mm.z},${mm.y}) rot ${mm.rot}`);
    await page.keyboard.press('KeyE'); await sleep(300);
    check('E vuelve a Propiedades', (await onTool()).endsWith('Propiedades') && !!(await page.$('.inspector h3')));
    check('Sin errores de consola tras el panel Movimiento', errors.length === 0, errors.slice(-3).join(' | '));

    // Rotación libre (#42)
    const rotIn = await fieldInput('Rotación');
    await rotIn.click({ count: 3 }); await rotIn.type('45'); await page.keyboard.press('Enter'); await sleep(500);
    mm = await modNow(target.id);
    const sb = await page.$eval('.sb-sel', (e) => e.textContent);
    check('Rotación libre: 45° desde Propiedades', mm.rot === 45 && sb.includes('Rotación: 45°'), sb);
    await shot('03c-rotacion-45');
    const before45 = { x: mm.x, z: mm.z };
    await dragBy(target.id, -8, 6, 12);
    mm = await modNow(target.id);
    check('Un módulo girado se sigue arrastrando', mm.rot === 45 && (mm.x !== before45.x || mm.z !== before45.z), `(${before45.x},${before45.z}) → (${mm.x},${mm.z})`);
    await ctrl('KeyZ'); await ctrl('KeyZ');
    mm = await modNow(target.id);
    check('Deshacer devuelve la rotación', mm.rot === m0.rot && mm.x === m0.x && mm.z === m0.z, `rot ${mm.rot}`);

    // Tamaño máximo con clic derecho (#45)
    const rc = await page.evaluate((id) => window.__muebles.screenOf(id, 100), target.id);
    await page.mouse.click(rc.x, rc.y, { button: 'right' }); await sleep(400);
    check('Clic derecho en un módulo abre su menú', !!(await page.$('.module-menu')));
    await clickText('.module-menu button', 'Ancho máximo');
    mm = await modNow(target.id);
    check('Ancho máximo estira hasta el obstáculo más cercano', mm.params.width > m0.params.width, `${m0.params.width} → ${mm.params.width}`);
    await shot('03d-ancho-maximo');
    await ctrl('KeyZ');
    mm = await modNow(target.id);
    check('Deshacer el tamaño máximo', mm.params.width === m0.params.width);
  }

  // Apoyar sobre lo de abajo (#46): una cajonera sobre la mesada de un bajo
  {
    const bajoC = (await project()).modules.find((m) => m.type === 'bajo_cajones');
    await insertFromCatalog('Cajonera interior'); await sleep(300);
    const setField = async (label, v) => { const f = await fieldInput(label); await f.click({ count: 3 }); await f.type(String(v)); await page.keyboard.press('Enter'); await sleep(300); };
    await setField('X (desde pared izq.)', bajoC.x);
    await setField('Z (desde pared fondo)', 0);
    const cid = (await project()).modules.at(-1).id;
    await page.evaluate(() => [...document.querySelectorAll('.inspector label.check-row')].find((l) => l.textContent.includes('Apoyar'))?.querySelector('input').click());
    await sleep(400);
    let cm2 = await modNow(cid);
    check('Apoyar sobre lo de abajo: la cajonera sube a la mesada del bajo', cm2.rest === true && cm2.y === bajoC.params.height + bajoC.params.mesadaT, `y=${cm2.y}`);
    for (let i = 0; i < 8; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Shift'); await sleep(150); }
    cm2 = await modNow(cid);
    check('Al sacarla de encima del bajo baja al piso', cm2.y === 0 && cm2.z >= 560, `z=${cm2.z}, y=${cm2.y}`);
    for (let i = 0; i < 8; i++) { await page.keyboard.down('Shift'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Shift'); await sleep(150); }
    cm2 = await modNow(cid);
    check('Al volver sobre el bajo se apoya otra vez en la mesada', cm2.y === bajoC.params.height + bajoC.params.mesadaT, `z=${cm2.z}, y=${cm2.y}`);
    await shot('03e-apoyar');
    await page.keyboard.press('Delete'); await sleep(300);
    check('Sin errores de consola tras apoyar', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Agregados (#81): tecla A, ruedas en vez de pies, estantes con cantidad
  {
    const ag = p.modules.find((m) => m.type === 'bajo_mixto');
    const agp = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ag.id);
    await page.mouse.click(agp.x, agp.y); await sleep(400);
    await page.keyboard.press('KeyA'); await sleep(300);
    const agRows = await page.$$eval('.aggregates .ag-row label', (els) => els.map((e) => e.textContent.trim()));
    check('Tecla A abre Herramientas · Agregados', ['Pies', 'Zócalo', 'Zócalo trasero', 'Ruedas', 'Fondo', 'Estantes', 'Divisiones', 'Barral'].every((l) => agRows.includes(l)), agRows.join(', '));
    const tick = (l) => page.evaluate((l) => [...document.querySelectorAll('.aggregates .ag-row label')].find((e) => e.textContent.trim() === l).querySelector('input').click(), l);
    await tick('Pies'); await sleep(200); await tick('Ruedas'); await sleep(300);
    await page.click('.aggregates button[aria-label="Opciones de Estantes"]'); await sleep(200);
    const qty = await page.$('.aggregates .ag-opts input');
    await qty.click({ count: 3 }); await qty.type('3'); await page.keyboard.press('Enter'); await sleep(400);
    let am = (await project()).modules.find((m) => m.id === ag.id);
    check('Agregados: ruedas en vez de pies y 3 estantes', am.aggs?.ruedas && !am.aggs?.pies && am.params.shelves === 3, JSON.stringify(am.aggs) + ' estantes ' + am.params.shelves);
    await clickText('.tabs button', 'Presupuesto'); await sleep(400);
    const rl = await page.$$eval('.page table tbody tr td:first-child', (els) => els.map((e) => e.textContent.trim()));
    check('Las ruedas van al presupuesto', rl.includes('Rueda giratoria con freno'));
    await clickText('.tabs button', 'Diseño 3D'); await sleep(500);
    await shot('02b-agregados');
    for (let i = 0; i < 3; i++) await ctrl('KeyZ');
    am = (await project()).modules.find((m) => m.id === ag.id);
    check('Deshacer los agregados', !am.aggs?.ruedas && am.params.shelves === ag.params.shelves);
    // Terminación (#82): marco superior y cornisa en una alacena → despiece
    const al = (await project()).modules.filter((m) => m.type === 'alacena').at(-1); // la de la derecha (la primera queda detrás del placard)
    await page.keyboard.press('Escape'); await sleep(200);
    const alp = await page.evaluate((id) => window.__muebles.screenOf(id, -200), al.id);
    await page.mouse.click(alp.x, alp.y); await sleep(400);
    await tick('Marco superior'); await sleep(200); await tick('Cornisa'); await sleep(300);
    const alm = (await project()).modules.find((m) => m.id === al.id);
    await shot('02c-marco-cornisa');
    await clickText('.tabs button', 'Plan de corte'); await sleep(500);
    const cutNames = await page.$$eval('.page table tbody tr', (rs) => rs.map((r) => r.textContent));
    check('Marco superior y cornisa en la alacena y en el despiece', !!alm.aggs?.marco && !!alm.aggs?.cornisa && cutNames.some((t) => t.includes('Cornisa')) && cutNames.some((t) => t.includes('Marco superior')));
    await clickText('.tabs button', 'Diseño 3D'); await sleep(500);
    await ctrl('KeyZ'); await ctrl('KeyZ');
    await page.keyboard.press('KeyE'); await page.keyboard.press('Escape'); await sleep(200);
  }

  // Aperturas (#84): abrir, cascada, doble clic, invertir bisagra
  {
    const ap = (await project()).modules.find((m) => m.type === 'bajo_mixto'); // visible desde la cámara (1 cajón + 2 puertas)
    const app = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ap.id);
    await page.mouse.click(app.x, app.y); await sleep(400);
    await clickText('.tools-item', '⇱Aperturas');
    const nFr = await page.$$eval('.ap-diagram .ap-front', (e) => e.length);
    check('Aperturas muestra el diagrama del frente', nFr === 3, nFr + ' frentes');
    await clickText('.ap-tools button', 'Abrir cascada'); await sleep(500);
    let os = await page.evaluate((id) => window.__muebles.openFronts?.[id], ap.id);
    check('Abrir cascada abre los cajones escalonados', os?.cascade === true);
    await shot('02d-cascada');
    await clickText('.ap-tools button', 'Cerrar'); await sleep(300);
    const dAl = (await project()).modules.filter((m) => m.type === 'alacena').at(-1); // frente hacia la cámara
    // al centro hay una luz de 3 mm entre las dos puertas: se apunta a la mitad de la puerta izquierda
    const dAlp = await page.evaluate((m) => window.__muebles.screenOfPoint(m.x + m.params.width / 4, m.z + m.params.depth + 10, m.y + m.params.height / 2), dAl);
    await page.mouse.click(dAlp.x, dAlp.y, { count: 2 }); await sleep(400);
    os = await page.evaluate((id) => window.__muebles.openFronts?.[id], dAl.id);
    check('Doble clic sobre una puerta en el 3D la abre', !!os && Object.values(os.open || {}).some(Boolean), JSON.stringify(os));
    await clickText('.ap-tools button', 'Cerrar todos'); await sleep(300);
    const al1 = (await project()).modules.find((m) => m.type === 'bajo_mixto');
    const al1p = await page.evaluate((id) => window.__muebles.screenOf(id, 100), al1.id);
    await page.mouse.click(al1p.x, al1p.y); await sleep(400);
    await page.evaluate(() => [...document.querySelectorAll('.ap-diagram .ap-front')].find((g) => g.textContent === 'Puerta').dispatchEvent(new MouseEvent('click', { bubbles: true }))); await sleep(200);
    await clickText('.ap-tools button', 'Invertir seleccionado'); await sleep(400);
    const inv = (await project()).modules.find((m) => m.id === al1.id).params.hinges;
    check('Invertir seleccionado cambia el lado de la bisagra', !!inv && Object.values(inv).length === 1, JSON.stringify(inv));
    await clickText('.ap-tools button', 'Abrir todos'); await sleep(500);
    await shot('02e-abrir-todos');
    await clickText('.ap-tools button', 'Cerrar todos'); await sleep(300);
    await ctrl('KeyZ');
    await page.keyboard.press('KeyE'); await page.keyboard.press('Escape'); await sleep(200);
  }

  // Posición del tirador (#85)
  {
    const tm = (await project()).modules.filter((m) => m.type === 'alacena').at(-1);
    const tmp = await page.evaluate((m) => window.__muebles.screenOfPoint(m.x + m.params.width / 4, m.z + m.params.depth + 10, m.y + m.params.height / 2), tm);
    await page.mouse.click(tmp.x, tmp.y); await sleep(400);
    await clickText('.tools-item', '⊥Posición del Tirador');
    await clickText('.tp-preset span', 'Personalizada');
    const offIn = await page.evaluateHandle(() => [...document.querySelectorAll('.tirador label.field')].find((l) => l.textContent.includes('Desde el borde'))?.querySelector('input'));
    await offIn.click({ count: 3 }); await offIn.type('120'); await page.keyboard.press('Enter'); await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.tp-orient label')].find((l) => l.textContent.trim() === 'Horizontal').querySelector('input').click()); await sleep(300);
    let tmm = (await project()).modules.find((m) => m.id === tm.id);
    check('Tirador personalizado a 120 mm y horizontal', tmm.params.handlePos === 'custom' && tmm.params.handleOffset === 120 && tmm.params.handleOrient === 'horizontal', JSON.stringify([tmm.params.handlePos, tmm.params.handleOffset, tmm.params.handleOrient]));
    await shot('02f-tirador');
    await clickText('.tirador button', 'Aplicar a todos los módulos');
    const all = (await project()).modules.filter((m) => m.params.handlePos !== undefined && !['tapa', 'vista', 'estante', 'escritorio'].includes(m.type));
    check('Aplicar a todos los módulos', all.every((m) => m.params.handlePos === 'custom' && m.params.handleOrient === 'horizontal'), all.length + ' módulos');
    for (let i = 0; i < 4; i++) await ctrl('KeyZ');
    tmm = (await project()).modules.find((m) => m.id === tm.id);
    check('Deshacer devuelve la posición del tirador', tmm.params.handlePos === tm.params.handlePos, tmm.params.handlePos);
    await page.keyboard.press('KeyE'); await page.keyboard.press('Escape'); await sleep(200);
  }

  // Arrastrar en vacío rota cámara, no deselecciona errores
  await page.mouse.move(700, 200); await page.mouse.down(); await page.mouse.move(800, 250, { steps: 8 }); await page.mouse.up();
  await sleep(300);

  // Vistas y render
  await clickText('.vp-toolbar button', 'Planta'); await sleep(600); await shot('03-planta');
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(400);
  await clickText('.vp-toolbar button', 'Modo render'); await sleep(2500); await shot('04-render');
  check('Modo render activo', await page.evaluate(() => [...document.querySelectorAll('.vp-toolbar button')].some((b) => b.textContent.includes('✓ Modo render'))));
  check('Sin errores tras render', errors.length === 0, errors.slice(-3).join(' | '));
  await clickText('.vp-toolbar button', '✓ Modo render'); await sleep(300); // salir del modo render rápido

  // Render (Fase 7 S1): diálogo Configuración del render, área del render y ventana de render
  const setRenderNum = async (label, v) => {
    const h = await page.evaluateHandle((l) => [...document.querySelectorAll('.render-dialog .field')].find((f) => f.textContent.includes(l))?.querySelector('input'), label);
    await h.click({ count: 3 }); await h.type(String(v)); await page.keyboard.press('Enter'); await sleep(250);
  };
  const rwImage = () => page.$eval('.render-window canvas.rw-image', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let diff = 0;
    for (let i = 0; i < d.length; i += 4 * 997) if (Math.abs(d[i] - 231) + Math.abs(d[i + 1] - 227) + Math.abs(d[i + 2] - 220) > 30) diff++;
    return { w: c.width, h: c.height, diff };
  }).catch((e) => ({ err: String(e) }));
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(500);
  check('Diálogo Configuración del render abierto', !!(await page.$('.render-dialog')));
  check('Área del render visible en la vista', !!(await page.$('.render-area')));
  await clickText('.render-dialog .radio', 'Render rápido');
  await clickText('.render-dialog .radio', 'Tamaños preconfigurados'); await sleep(200);
  await page.select('.rd-preset', 'hd'); await sleep(300);
  const areaRatio = await page.$eval('.render-area', (e) => e.offsetWidth / e.offsetHeight);
  check('El área del render toma la proporción de la imagen (16:9)', Math.abs(areaRatio - 16 / 9) < 0.02, areaRatio.toFixed(3));
  await shot('04a-render-dialogo');
  await clickText('.render-dialog .radio', 'Personalizada'); await sleep(200);
  await setRenderNum('Ancho', 800);
  const szTxt = await page.$eval('.rd-size b', (e) => e.textContent.replace(/\s/g, ''));
  check('Proporción trabada: ancho 800 → alto 450', szTxt === '800×450', szTxt);
  await clickText('.render-dialog .radio', 'Tamaños preconfigurados'); await sleep(200);
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(1500);
  const rr = await rwImage();
  check('Render rápido: imagen de 1280 × 720', rr.w === 1280 && rr.h === 720, JSON.stringify(rr));
  check('Render rápido dibuja el ambiente', rr.diff > 50, `${rr.diff} píxeles distintos del fondo`);
  await shot('04b-render-rapido');
  await page.evaluate(() => {
    window.__dl = []; window.__aclick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { if (this.download) { window.__dl.push(this.download); return undefined; } return window.__aclick.call(this); };
  });
  await clickText('.render-window button', 'Guardar imagen'); await sleep(800);
  const dls = await page.evaluate(() => window.__dl);
  check('Guardar imagen baja un PNG', dls.length === 1 && dls[0].endsWith('.png'), dls.join(','));
  await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__aclick; });
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  check('Cerrar la ventana de render', !(await page.$('.render-window')));

  // Render final (trazado de rayos) en la ventana, a un tamaño chico
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.render-dialog .radio', 'Render final');
  await clickText('.render-dialog .radio', 'Personalizada'); await sleep(200);
  await setRenderNum('Ancho', 400);
  await clickText('.render-dialog footer button', 'Renderizar');
  let sm = 0;
  for (let i = 0; i < 40 && sm < 10; i++) { await sleep(1500); sm = await page.$eval('.rw-progress b', (e) => parseInt(e.textContent, 10)).catch(() => 0); }
  await shot('04c-render-final');
  check('Render final acumula muestras', sm > 0, `${sm} muestras`);
  const rf = await rwImage();
  check('Render final al tamaño pedido (400 × 225)', rf.w === 400 && rf.h === 225, JSON.stringify(rf));
  await clickText('.render-window button', 'Detener'); await sleep(400);
  check('Detener frena el render', (await page.$eval('.rw-progress', (e) => e.textContent)).startsWith('Detenido'));
  check('Sin errores en render final', errors.length === 0, errors.slice(-3).join(' | '));
  await clickText('.render-window button', 'Cerrar'); await sleep(300);

  // Clima: sol y cielo (Fase 7 S2)
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Clima'); await sleep(300);
  await clickText('.rd-climas button', 'Atardecer'); await sleep(500);
  let clima = (await project()).render.clima;
  let sun = await page.evaluate(() => window.__muebles.sun());
  check('Clima Atardecer: sol bajo (altitud 10°) y anaranjado', clima.preset === 'atardecer' && clima.altitude === 10 && sun.color === '#ffa865' && sun.dir[1] < 0.2, JSON.stringify(sun));
  await shot('04d-clima');
  const comp = await page.$eval('.sun-compass', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * (106 / 120), y: r.top + r.height / 2 }; });
  await page.mouse.click(comp.x, comp.y); await sleep(400);
  clima = (await project()).render.clima;
  sun = await page.evaluate(() => window.__muebles.sun());
  check('Brújula: clic a la derecha → azimut 90° y el sol viene de la derecha', clima.azimuth === 90 && sun.dir[0] > 0.9, `${clima.azimuth}° ${JSON.stringify(sun.dir)}`);
  const arc = await page.$eval('.sun-altitude', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * (10 / 120) + 40, y: r.top + r.height * (110 / 120) - 40 }; });
  await page.mouse.click(arc.x, arc.y); await sleep(400);
  check('Arco de altitud: clic a 45° → altitud 45°', (await project()).render.clima.altitude === 45, String((await project()).render.clima.altitude));
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
  check('Deshacer vuelve la altitud de a un paso', (await project()).render.clima.altitude === 10, String((await project()).render.clima.altitude));
  await clickText('.rd-climas button', 'No aplicar'); await sleep(400);
  sun = await page.evaluate(() => window.__muebles.sun());
  check('No aplicar apaga el sol', sun.visible === false);
  await clickText('.rd-tabs button', 'Calidad'); await sleep(200);
  await clickText('.render-dialog .radio', 'Render rápido'); await sleep(200);
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(1500);
  const rn = await rwImage();
  check('Render sin luz natural sale igual (solo luz ambiente)', rn.w > 0 && rn.diff > 50, JSON.stringify(rn));
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Clima'); await sleep(200);
  await clickText('.rd-climas button', 'Luz blanca'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(300);
  check('Sin errores con el clima', errors.length === 0, errors.slice(-3).join(' | '));

  // Fondo del render (Fase 7 S3): color, degradé e imagen; solo en la imagen renderizada
  const countColor = (rgb) => page.$eval('.render-window canvas.rw-image', (c, rgb) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0, t = 0;
    for (let i = 0; i < d.length; i += 4 * 101) { t++; if (Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < 24) n++; }
    return n / t;
  }, rgb);
  const setColorInput = (sel, value) => page.$eval(sel, (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Fondo'); await sleep(200);
  await clickText('.render-dialog .radio', 'Color'); await sleep(100);
  await setColorInput('.rd-color input', '#d02020'); await sleep(300);
  check('Fondo: el color queda en el proyecto', (await project()).render.background.color === '#d02020');
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(1500);
  const redFrac = await countColor([208, 32, 32]);
  check('Render con fondo de color: se ve detrás del ambiente', redFrac > 0.02, `${(redFrac * 100).toFixed(1)} %`);
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Fondo'); await sleep(200);
  await clickText('.render-dialog .radio', 'Imagen'); await sleep(200);
  await page.$eval('.rd-file', async (input) => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d'); g.fillStyle = '#1e40ff'; g.fillRect(0, 0, 64, 32);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'fondo.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  let bgp = null;
  for (let i = 0; i < 20 && !bgp?.image; i++) { await sleep(300); bgp = (await project()).render.background; }
  check('Fondo: la imagen elegida se guarda con el proyecto', bgp.mode === 'imagen' && bgp.image?.startsWith('data:image/jpeg'), bgp.image?.slice(0, 30));
  await shot('04e-fondo');
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(2000);
  const blueFrac = await countColor([30, 64, 255]);
  check('Render con imagen de fondo: cubre el cuadro detrás del ambiente', blueFrac > 0.02, `${(blueFrac * 100).toFixed(1)} %`);
  await shot('04f-render-fondo');
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Fondo'); await sleep(200);
  await clickText('.render-dialog .radio', 'Degradé'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(300);
  check('Sin errores con el fondo', errors.length === 0, errors.slice(-3).join(' | '));

  // Marca de agua (Fase 7 S4): imagen, posición, transparencia y distancia al borde
  const pixelAt = (x, y) => page.$eval('.render-window canvas.rw-image', (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data], x, y);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Marca de agua'); await sleep(200);
  await page.$eval('.rd-wm-file', async (input) => {
    const c = document.createElement('canvas'); c.width = 100; c.height = 50;
    const g = c.getContext('2d'); g.fillStyle = '#ff0000'; g.fillRect(0, 0, 100, 50);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'logo.png', { type: 'image/png' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  let wmSaved = null;
  for (let i = 0; i < 20 && !wmSaved?.image; i++) { await sleep(300); wmSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.render.watermark'))); }
  check('Marca de agua: la imagen se guarda para los próximos renders', wmSaved?.use === true && wmSaved.image?.startsWith('data:image/png'));
  await page.click('.rd-wm-pos button[aria-label="Inferior derecha"]'); await sleep(200);
  await page.$eval('.rd-slider input[type=range]', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '0');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(300);
  check('Marca de agua visible en el área del render', !!(await page.$('.render-area .render-area-wm')));
  await shot('04g-marca-agua');
  await clickText('.rd-tabs button', 'Calidad'); await sleep(200);
  const wmSize = await page.$eval('.rd-size b', (e) => e.textContent.replace(/\s/g, '').split('×').map(Number));
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(2000);
  // logo 100 × 50 a 20 px de los bordes inferior y derecho
  const wmPx = await pixelAt(wmSize[0] - 20 - 50, wmSize[1] - 20 - 25);
  check('Render con marca de agua abajo a la derecha (opaca)', wmPx[0] > 230 && wmPx[1] < 30 && wmPx[2] < 30, `${wmSize.join('×')} ${wmPx.join(',')}`);
  const outPx = await pixelAt(wmSize[0] - 20 - 50, wmSize[1] - 20 - 25 - 60);
  check('Fuera de la marca no hay rojo', !(outPx[0] > 230 && outPx[1] < 30 && outPx[2] < 30), outPx.join(','));
  await shot('04h-render-marca');
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Marca de agua'); await sleep(200);
  await page.$eval('.rd-slider input[type=range]', (el) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '60');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(2000);
  const semi = await pixelAt(wmSize[0] - 20 - 50, wmSize[1] - 20 - 25);
  check('Transparencia 60 %: la marca se mezcla con la imagen (ni rojo puro ni sin rojo)', semi[1] > 60 && semi[0] > semi[1] + 40, semi.join(','));
  await clickText('.render-window button', 'Cerrar'); await sleep(300);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Marca de agua'); await sleep(200);
  await clickText('.render-dialog .check', 'Usar marca de agua'); await sleep(200);
  check('Destildar "Usar marca de agua" la apaga', (await page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.render.watermark')).use)) === false);
  await page.keyboard.press('Escape'); await sleep(300);
  check('Sin errores con la marca de agua', errors.length === 0, errors.slice(-3).join(' | '));

  // Render 360° (Fase 7 S5): panorama 2:1 desde el centro del ambiente y visor arrastrable
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', 'Calidad'); await sleep(150);
  await clickText('.render-dialog .radio', 'Render rápido'); await sleep(150);
  await clickText('.rd-tabs button', '360'); await sleep(200);
  await clickText('.render-dialog .check', 'Panorama 360°'); await sleep(300);
  check('360°: el panorama usa su resolución 2:1', (await project()).render.panorama.on === true);
  await clickText('.render-dialog footer button', 'Renderizar'); await sleep(2500);
  const pano = await rwImage();
  check('Render 360°: imagen equirectangular de 2048 × 1024', pano.w === 2048 && pano.h === 1024, JSON.stringify(pano));
  const lowered = await page.evaluate(() => Object.values(window.__mueblesLowered || {}).filter(Boolean).length);
  check('360°: las paredes se ven completas (sin Auto Rebajar) mientras se renderiza', lowered === 0, `${lowered} rebajadas`);
  await shot('04i-render-360');
  await page.evaluate(() => {
    window.__dl = []; window.__aclick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { if (this.download) { window.__dl.push(this.download); return undefined; } return window.__aclick.call(this); };
  });
  await clickText('.render-window button', 'Guardar imagen'); await sleep(1200);
  const dl360 = await page.evaluate(() => window.__dl);
  check('Guardar el panorama baja un PNG "-360"', dl360.length === 1 && dl360[0].endsWith('-360.png'), dl360.join(','));
  await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__aclick; });
  await clickText('.render-window button', 'Ver 360°'); await sleep(800);
  check('Ver 360° abre el visor panorámico', !!(await page.$('.pano-viewer canvas')));
  const pv = await page.$eval('.pv-canvas', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(pv.x, pv.y); await page.mouse.down(); await page.mouse.move(pv.x - 300, pv.y + 50, { steps: 8 }); await page.mouse.up(); await sleep(300);
  const pvView = await page.$eval('.pano-viewer', (e) => ({ yaw: +e.dataset.yaw, pitch: +e.dataset.pitch }));
  check('Visor 360°: arrastrar a la izquierda gira a la derecha', pvView.yaw === 60 && pvView.pitch === 10, JSON.stringify(pvView));
  await page.mouse.move(pv.x, pv.y); await page.mouse.wheel({ deltaY: -400 }); await sleep(300);
  check('Visor 360°: la rueda acerca (FOV menor)', +(await page.$eval('.pano-viewer', (e) => e.dataset.fov)) < 75);
  await shot('04j-visor-360');
  await clickText('.pano-viewer button', 'Volver a la imagen'); await sleep(300);
  await clickText('.render-window button', 'Cerrar'); await sleep(400);
  await clickText('.vp-toolbar button', 'Renderizar…'); await sleep(300);
  await clickText('.rd-tabs button', '360'); await sleep(200);
  await clickText('.render-dialog .check', 'Panorama 360°'); await sleep(200);
  await page.keyboard.press('Escape'); await sleep(300);
  check('Sin errores con el 360°', errors.length === 0, errors.slice(-3).join(' | '));

  // Fase 7b S1: selección múltiple en el 3D (Ctrl+clic, Ctrl+T) y acciones en grupo
  {
    await page.keyboard.press('Escape'); await sleep(200);
    let pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const mb = pm.modules.filter((m) => m.type === 'alacena').at(-1);
    const ctrlClick = async (id) => {
      const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), id);
      await page.keyboard.down('Control'); await page.mouse.click(q.x, q.y); await page.keyboard.up('Control'); await sleep(300);
    };
    await ctrlClick(ma.id); await ctrlClick(mb.id);
    const sbTxt = await page.$eval('.sb-sel', (e) => e.textContent);
    check('Ctrl+clic suma módulos a la selección', sbTxt.startsWith('2 módulos seleccionados'), sbTxt);
    check('Propiedades muestra la selección múltiple', !!(await page.$('.multi-sel')));
    await shot('07a-seleccion-multiple');
    const before = new Map(pm.modules.map((m) => [m.id, m]));
    await page.keyboard.press('PageUp'); await sleep(300);
    pm = await project();
    const raised = pm.modules.filter((m) => (m.y || 0) !== (before.get(m.id).y || 0));
    check('Subir con la selección múltiple mueve los dos (y nada más)', raised.length === 2 && raised.every((m) => (m.y || 0) - (before.get(m.id).y || 0) === 10), raised.map((m) => m.type).join(','));
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    const b2 = new Map((await project()).modules.map((m) => [m.id, m]));
    await dragBy(ma.id, 0, 6, 20); // hacia el frente: ahí no hay nada contra qué chocar
    pm = await project();
    const dza = pm.modules.find((m) => m.id === ma.id).z - b2.get(ma.id).z;
    const dzb = pm.modules.find((m) => m.id === mb.id).z - b2.get(mb.id).z;
    check('Arrastrar uno de la selección mueve el conjunto rígido', dza !== 0 && dza === dzb, `${dza} / ${dzb}`);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    await ctrlClick(mb.id);
    check('Ctrl+clic en uno ya seleccionado lo quita', (await page.$eval('.sb-sel', (e) => e.textContent)).startsWith('Bajo') || !(await page.$('.multi-sel')));
    await page.keyboard.down('Control'); await page.keyboard.press('KeyT'); await page.keyboard.up('Control'); await sleep(300);
    const nVis = (await project()).modules.filter((m) => !m.hidden).length;
    check('Ctrl+T selecciona todos los módulos visibles', (await page.$eval('.sb-sel', (e) => e.textContent)).startsWith(`${nVis} módulos seleccionados`), await page.$eval('.sb-sel', (e) => e.textContent));
    await page.keyboard.press('Escape'); await sleep(200);
    check('Esc deja sin selección', (await page.$eval('.sb-sel', (e) => e.textContent)) === 'Sin selección');
    check('Sin errores con la selección múltiple', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S2: Agrupar (U) y Desagrupar (Ctrl+U)
  {
    let pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const mb = pm.modules.filter((m) => m.type === 'alacena').at(-1);
    const clickMod = async (id, ctrl = false) => {
      const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), id);
      if (ctrl) await page.keyboard.down('Control');
      await page.mouse.click(q.x, q.y);
      if (ctrl) await page.keyboard.up('Control');
      await sleep(300);
    };
    await clickMod(ma.id, true); await clickMod(mb.id, true);
    await page.keyboard.press('KeyU'); await sleep(300);
    pm = await project();
    const ga = pm.modules.find((m) => m.id === ma.id).groupId;
    check('U agrupa los seleccionados', !!ga && pm.modules.find((m) => m.id === mb.id).groupId === ga);
    await page.keyboard.press('Escape'); await sleep(200);
    await clickMod(ma.id);
    const sbg = await page.$eval('.sb-sel', (e) => e.textContent);
    check('Clic en un integrante selecciona el grupo entero', sbg.startsWith('Grupo de 2 módulos'), sbg);
    check('El panel muestra el grupo', (await page.$eval('.multi-sel h3', (e) => e.textContent)) === 'Grupo');
    await shot('07b-grupo');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyU'); await page.keyboard.up('Control'); await sleep(300);
    pm = await project();
    check('Ctrl+U desagrupa', !pm.modules.some((m) => m.groupId));
    await page.keyboard.press('Escape'); await sleep(200);
    await clickMod(ma.id);
    check('Desagrupado, el clic vuelve a elegir un solo módulo', !(await page.$('.multi-sel')));
    await page.keyboard.press('Escape'); await sleep(200);
    check('Sin errores con los grupos', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S3: Copiar / Cortar / Pegar
  {
    let pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ma.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    const n0 = pm.modules.length;
    const ctrlKey = async (k) => { await page.keyboard.down('Control'); await page.keyboard.press(k); await page.keyboard.up('Control'); await sleep(300); };
    await ctrlKey('KeyC'); await ctrlKey('KeyV');
    pm = await project();
    const pasted = pm.modules.at(-1);
    check('Ctrl+C / Ctrl+V pega una copia al lado', pm.modules.length === n0 + 1 && pasted.type === 'bajo_mixto' && pasted.id !== ma.id && pasted.x > ma.x && pasted.z === ma.z, `${ma.x} → ${pasted.x}`);
    await ctrlKey('KeyV');
    pm = await project();
    check('Pegar otra vez la corre otro tanto', pm.modules.length === n0 + 2 && pm.modules.at(-1).x - ma.x === 2 * (pasted.x - ma.x));
    await ctrlKey('KeyX');
    pm = await project();
    check('Ctrl+X corta lo seleccionado', pm.modules.length === n0 + 1);
    await ctrlKey('KeyZ'); await ctrlKey('KeyZ'); await ctrlKey('KeyZ');
    check('Deshacer vuelve atrás los pegados', (await project()).modules.length === n0);
    await page.keyboard.press('Escape'); await sleep(200);
    check('Sin errores con copiar y pegar', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S4: Ubicar en el catálogo (Ctrl+Shift+L) y Sustitución rápida (S)
  {
    let pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ma.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    await page.keyboard.down('Control'); await page.keyboard.down('Shift'); await page.keyboard.press('KeyL'); await page.keyboard.up('Shift'); await page.keyboard.up('Control'); await sleep(700);
    const pickedTxt = await page.$eval('.mod-btn.picked span', (e) => e.textContent).catch(() => '');
    check('Ctrl+Shift+L ubica el módulo en la barra de modulación', pickedTxt.length > 0, pickedTxt);
    // marcar otro ítem de la misma subfamilia y sustituir con S
    const other = await page.evaluate(() => { const b = [...document.querySelectorAll('.cb-items .mod-btn')].find((x) => !x.classList.contains('picked')); b?.click(); return b?.querySelector('span')?.textContent; });
    await sleep(300);
    check('El botón Sustitución rápida se habilita', !(await page.$eval('.cb-replace', (b) => b.disabled)));
    await page.keyboard.press('KeyS'); await sleep(500);
    pm = await project();
    const r = pm.modules.find((m) => m.id === ma.id);
    check('S sustituye el módulo en el mismo lugar', r && (r.name === other || r.itemId) && r.x === ma.x && r.z === ma.z && r.rot === ma.rot, `${ma.type} → ${r?.type} (${other})`);
    await shot('07c-sustitucion');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    check('Deshacer vuelve al módulo original', (await project()).modules.find((m) => m.id === ma.id).type === 'bajo_mixto');
    await page.keyboard.press('Escape'); await sleep(200);
    check('Sin errores con la sustitución', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S5: Ctrl+flechas hasta el extremo, Ctrl+Inicio centrar, Shift+mouse girar, I invertir
  {
    let pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ma.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    const ck = async (k) => { await page.keyboard.down('Control'); await page.keyboard.press(k); await page.keyboard.up('Control'); await sleep(300); };
    await ck('ArrowDown');
    pm = await project();
    const fwd = pm.modules.find((m) => m.id === ma.id);
    check('Ctrl+↓ lleva el módulo hasta el frente (obstáculo más cercano)', fwd.z !== ma.z || fwd.x !== ma.x, `(${ma.x},${ma.z}) → (${fwd.x},${fwd.z})`);
    await ck('KeyZ');
    await ck('Home');
    pm = await project();
    check('Ctrl+Inicio no rompe nada (centra a lo ancho si tiene a los dos costados)', !!pm.modules.find((m) => m.id === ma.id));
    await ck('KeyZ');
    const h0 = JSON.stringify(pm.modules.find((m) => m.id === ma.id).params.hinges || {});
    await page.keyboard.press('KeyI'); await sleep(300);
    pm = await project();
    check('I invierte las bisagras del módulo', JSON.stringify(pm.modules.find((m) => m.id === ma.id).params.hinges || {}) !== h0);
    await ck('KeyZ');
    const rot0 = (await project()).modules.find((m) => m.id === ma.id).rot || 0;
    await page.mouse.move(q.x, q.y); await page.keyboard.down('Shift');
    for (let i = 1; i <= 10; i++) { await page.mouse.move(q.x + 6 * i, q.y); await sleep(30); }
    await page.keyboard.up('Shift'); await sleep(300);
    const rot1 = (await project()).modules.find((m) => m.id === ma.id).rot || 0;
    check('Shift + mover el mouse gira el módulo', rot1 !== rot0, `${rot0}° → ${rot1}°`);
    await ck('KeyZ');
    check('Deshacer vuelve el giro de una vez', ((await project()).modules.find((m) => m.id === ma.id).rot || 0) === rot0);
    await page.keyboard.press('Escape'); await sleep(200);
    check('Sin errores con los atajos de movimiento', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S6: menú Vistas, Volver/Avanzar vista, F8 y doble clic en pared/piso
  {
    await page.select('.vp-views', 'iso-izq'); await sleep(900);
    let cp = await page.evaluate(() => window.__muebles.camPos());
    check('Vistas: Isométrica izquierda mira desde la izquierda', cp[0] < 0 && cp[2] > 0, cp.map((v) => v.toFixed(1)).join(','));
    await shot('07d-vista-iso-izq');
    await page.select('.vp-views', 'iso-tras-der'); await sleep(900);
    cp = await page.evaluate(() => window.__muebles.camPos());
    check('Vistas: Isométrica trasera derecha', cp[0] > 0 && cp[2] < 0);
    await clickText('.vp-toolbar button', '◁'); await sleep(900);
    check('Volver vista regresa a la anterior', (await page.$eval('.vp-views', (e) => e.value)) === 'iso-izq');
    await clickText('.vp-toolbar button', '▷'); await sleep(900);
    check('Avanzar vista', (await page.$eval('.vp-views', (e) => e.value)) === 'iso-tras-der');
    await page.keyboard.press('F8'); await sleep(900);
    check('F8 pasa a ortogonal', (await page.evaluate(() => window.__muebles.cameraType)) === 'OrthographicCamera');
    await page.keyboard.press('F8'); await sleep(900);
    check('F8 vuelve a perspectiva', (await page.evaluate(() => window.__muebles.cameraType)) === 'PerspectiveCamera');
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(900);
    const pw = await project();
    const back = pw.room.walls[1] || pw.room.walls[0];
    const wp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), back.id);
    await page.mouse.click(wp.x, wp.y, { count: 2 }); await sleep(1000);
    const vsel = await page.$eval('.vp-views option:checked', (e) => e.textContent);
    check('Doble clic en una pared muestra su vista frontal', vsel.startsWith('Pared'), vsel);
    await shot('07e-vista-pared');
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(900);
    const xs = pw.room.nodes.map((n) => n.x), zs = pw.room.nodes.map((n) => n.z);
    const fp = await page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z, 0), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...zs) - 250);
    await page.mouse.click(fp.x, fp.y, { count: 2 }); await sleep(1000);
    check('Doble clic en el piso pasa a Planta', (await page.evaluate(() => window.__muebles.cameraType)) === 'OrthographicCamera' && (await page.$eval('.vp-views', (e) => e.value)) === 'planta');
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(900);
    const mq = await page.evaluate((id) => window.__muebles.screenOf(id, 100), pw.modules.find((m) => m.type === 'bajo_mixto').id);
    await page.mouse.click(mq.x, mq.y); await sleep(300);
    const fp2 = await page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z, 0), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...zs) - 250);
    await page.mouse.click(fp2.x, fp2.y); await sleep(300);
    check('Clic simple en el piso vacío sigue deseleccionando', (await page.$eval('.sb-sel', (e) => e.textContent)) === 'Sin selección');
    check('Sin errores con las vistas', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S7: Zoom total (F6), Zoom entidad (F7), Zoom ventana (W), Pan (P), Caminar (C)
  {
    const camPos = () => page.evaluate(() => window.__muebles.camPos());
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ma.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    const cx = pm.room.nodes.reduce((a, n) => a + n.x, 0) / pm.room.nodes.length;
    const xs = pm.room.nodes.map((n) => n.x), zs = pm.room.nodes.map((n) => n.z);
    const center = [(ma.x + 300 - (Math.min(...xs) + Math.max(...xs)) / 2) / 1000, 0.4, (ma.z + 300 - (Math.min(...zs) + Math.max(...zs)) / 2) / 1000];
    const c0 = await camPos();
    await page.keyboard.press('F7'); await sleep(500);
    const c1 = await camPos();
    check('F7 encuadra lo seleccionado (se acerca)', dist(c1, center) < dist(c0, center), `${dist(c0, center).toFixed(2)} → ${dist(c1, center).toFixed(2)} m (cx ${cx | 0})`);
    await page.keyboard.press('F6'); await sleep(500);
    const c2 = await camPos();
    check('F6 Zoom total aleja para ver todo', Math.hypot(...c2) > Math.hypot(...c1));
    await page.keyboard.press('KeyW'); await sleep(200);
    check('W activa Zoom ventana', !!(await page.$('.nav-overlay.zoomWin')));
    const vp = await page.$eval('.vp-area', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(vp.x + vp.w * 0.4, vp.y + vp.h * 0.4); await page.mouse.down();
    await page.mouse.move(vp.x + vp.w * 0.6, vp.y + vp.h * 0.6, { steps: 6 }); await page.mouse.up(); await sleep(500);
    const c3 = await camPos();
    check('Zoom ventana acerca al recuadro y vuelve a Seleccionar', dist(c3, [0, 0, 0]) < dist(c2, [0, 0, 0]) && !(await page.$('.nav-overlay')));
    await page.keyboard.press('KeyP'); await sleep(200);
    check('P activa la herramienta Pan', (await page.$eval('.vp-toolbar .nav-tool.active', (e) => e.textContent).catch(() => '')) === 'Pan');
    await page.keyboard.press('KeyM'); await sleep(200);
    check('M vuelve a Seleccionar/Mover', !(await page.$('.vp-toolbar .nav-tool.active')));
    await page.keyboard.press('KeyC'); await sleep(200);
    const c4 = await camPos();
    await page.mouse.move(vp.x + vp.w / 2, vp.y + vp.h / 2); await page.mouse.down();
    await page.mouse.move(vp.x + vp.w / 2, vp.y + vp.h / 2 - 80, { steps: 8 }); await page.mouse.up(); await sleep(300);
    const c5 = await camPos();
    check('Caminar: arrastrar hacia arriba avanza', dist(c4, c5) > 0.3 && Math.abs(c4[1] - c5[1]) < 1e-6, dist(c4, c5).toFixed(2) + ' m');
    await page.keyboard.press('Escape'); await sleep(200);
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(800);
    check('Sin errores con la navegación', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S8: modos de relleno (F10 el siguiente, Ctrl+F10 Presentación)
  {
    const fillNow = () => page.$eval('.vp-fill', (e) => e.value);
    check('Relleno por defecto: Texturas', (await fillNow()) === 'texturas');
    const px = async () => page.evaluate(() => { const c = document.querySelector('.vp-area canvas'); const g = document.createElement('canvas'); g.width = 80; g.height = 50; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 80, 50); const d = x.getImageData(0, 0, 80, 50).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; });
    const lum0 = await px();
    await page.select('.vp-fill', 'oculto-bn'); await sleep(1200);
    const lumBN = await px();
    check('Oculto B/N: fondo negro y líneas blancas', lumBN < lum0 / 2, `${lum0.toFixed(0)} → ${lumBN.toFixed(0)}`);
    await shot('07f-relleno-oculto-bn');
    await page.keyboard.press('F10'); await sleep(600);
    check('F10 pasa al siguiente modo', (await fillNow()) === 'sin-relleno');
    await page.keyboard.down('Control'); await page.keyboard.press('F10'); await page.keyboard.up('Control'); await sleep(800);
    check('Ctrl+F10 pasa a Presentación', (await fillNow()) === 'presentacion');
    await page.select('.vp-fill', 'caja'); await sleep(800);
    const pm = await project();
    const ma = pm.modules.find((m) => m.type === 'bajo_mixto');
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), ma.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    check('Caja de contorno: el módulo se sigue eligiendo con un clic', (await page.$eval('.sb-sel', (e) => e.textContent)).length > 0 && (await page.$eval('.sb-sel', (e) => e.textContent)) !== 'Sin selección');
    await page.keyboard.press('Escape');
    await page.select('.vp-fill', 'texturas'); await sleep(600);
    check('Sin errores con los modos de relleno', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S9: materiales de paredes y piso (Cara / Todo, propiedades, Copiar material, Cambiar tonalidad)
  {
    let pm = await project();
    const nz = (id) => pm.room.nodes.find((n) => n.id === id).z;
    const sorted = [...pm.room.walls].sort((a, b) => (nz(a.n0) + nz(a.n1)) - (nz(b.n0) + nz(b.n1)));
    const back = sorted[0], other = sorted.find((w) => w.id !== back.id);
    await clickText('.side-tab', 'Materiales'); await sleep(500);
    const wp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), back.id);
    await page.mouse.click(wp.x, wp.y); await sleep(300);
    await clickText('.rm-tabs button', 'Pinturas'); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.rm-item')].find((e) => e.textContent.includes('Terracota')).click()); await sleep(500);
    pm = await project();
    check('Clic en un material lo aplica a la pared seleccionada (cara interior)', pm.room.finishes?.walls?.[back.id]?.mat === 'pint-terracota');
    await shot('07g-material-pared');
    // soltar un material sobre una pared: pregunta Cara / Todo
    await page.evaluate(({ x, y }) => {
      const dt = new DataTransfer(); dt.setData('text/x-room-mat', 'pint-salvia');
      document.querySelector('.vp-area').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }));
    }, wp); await sleep(400);
    check('Soltar un material en una pared pregunta Cara / Todo', !!(await page.$('.mat-scope')));
    await clickText('.mat-scope button', 'Todo'); await sleep(400);
    pm = await project();
    check('"Todo" lo aplica a todas las paredes', pm.room.walls.every((w) => pm.room.finishes.walls[w.id]?.mat === 'pint-salvia'));
    // piso: con la pestaña abierta, clic en el piso lo selecciona y el material va al piso
    const xs = pm.room.nodes.map((n) => n.x), zs = pm.room.nodes.map((n) => n.z);
    const fp = await page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z, 0), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...zs) - 250);
    await page.mouse.click(fp.x, fp.y); await sleep(300);
    check('Clic en el piso lo selecciona (pestaña Materiales)', (await page.$eval('.sb-sel', (e) => e.textContent)) === 'Piso');
    await clickText('.rm-tabs button', 'Pisos'); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.rm-item')].find((e) => e.textContent.includes('Madera roble')).click()); await sleep(500);
    pm = await project();
    check('El material va al piso', pm.room.finishes.floor?.mat === 'piso-roble');
    // propiedades en Propiedades > Ambiente > Piso
    await page.keyboard.press('Escape'); await sleep(200);
    const rotIn = await page.evaluateHandle(() => [...document.querySelectorAll('.finish-fields .field')].find((f) => f.textContent.includes('Rotación'))?.querySelector('input'));
    await rotIn.click({ count: 3 }); await rotIn.type('90'); await page.keyboard.press('Enter'); await sleep(300);
    check('Rotación del material del piso', (await project()).room.finishes.floor.rot === 90);
    await shot('07h-material-piso');
    // Copiar material: origen la pared del fondo, destino otra pared
    await page.mouse.click(wp.x, wp.y); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.rm-item')].length); // panel abierto
    await clickText('.rm-tabs button', 'Pinturas'); await sleep(150);
    await page.evaluate(() => [...document.querySelectorAll('.rm-item')].find((e) => e.textContent.includes('Grafito')).click()); await sleep(300);
    await clickText('.rm-tools button', 'Copiar material'); await sleep(200);
    await page.mouse.click(wp.x, wp.y); await sleep(300);
    const op = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), other.id);
    await page.mouse.click(op.x, op.y); await sleep(400);
    pm = await project();
    check('Copiar material: la otra pared toma el de la pared de origen', pm.room.finishes.walls[other.id]?.mat === 'pint-grafito', pm.room.finishes.walls[other.id]?.mat);
    await page.keyboard.press('KeyM'); await sleep(200);
    check('M termina Copiar material', !(await page.$('.rm-tools button.active')));
    await clickText('.side-tab', 'Materiales'); await sleep(300);
    check('Sin errores con los materiales del ambiente', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S10: franjas en pared (material por fila) y regiones (piso)
  {
    let pm = await project();
    const nz = (id) => pm.room.nodes.find((n) => n.id === id).z;
    const back = [...pm.room.walls].sort((a, b) => (nz(a.n0) + nz(a.n1)) - (nz(b.n0) + nz(b.n1)))[0];
    await clickText('.side-tab', 'Materiales'); await sleep(400);
    const wp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), back.id);
    await page.mouse.click(wp.x, wp.y); await sleep(300);
    await clickText('.rm-tools button', 'Editar franjas'); await sleep(400);
    check('Editor de franjas abierto', !!(await page.$('.strip-editor')));
    await clickText('.strip-editor .se-tools button', 'Franja horizontal'); await sleep(100);
    const sv = await page.$eval('.strip-editor svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(sv.x + sv.w / 2, sv.y + sv.h * 0.45); await sleep(300);
    pm = await project();
    check('Clic con "Franja horizontal" agrega una franja', (pm.room.strips?.[back.id]?.h || []).length === 1, JSON.stringify(pm.room.strips?.[back.id]));
    await shot('07i-editor-franjas');
    await clickText('.strip-editor .row-btns button', 'Aceptar'); await sleep(300);
    await page.evaluate(({ x, y }) => { const dt = new DataTransfer(); dt.setData('text/x-room-mat', 'rev-subway-verde'); document.querySelector('.vp-area').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt })); }, wp); await sleep(400);
    const opts = await page.$$eval('.mat-scope button', (b) => b.map((x) => x.textContent));
    check('Con franjas, el material pregunta Región / Perfil horizontal / Perfil vertical / Cara / Todo', opts.join('|') === 'Región|Perfil horizontal|Perfil vertical|Cara|Todo', opts.join('|'));
    await clickText('.mat-scope button', 'Perfil horizontal'); await sleep(500);
    pm = await project();
    check('Perfil horizontal: la fila de la franja toma el material', Object.values(pm.room.stripFinishes?.[back.id] || {}).some((f) => f.mat === 'rev-subway-verde'));
    await shot('07j-franja-3d');
    const xs = pm.room.nodes.map((n) => n.x), zs = pm.room.nodes.map((n) => n.z);
    const fp = await page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z, 0), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...zs) - 250);
    await page.mouse.click(fp.x, fp.y); await sleep(300);
    await clickText('.rm-tools button', 'Editar regiones'); await sleep(400);
    await clickText('.region-editor .se-tools button', 'Rectángulo'); await sleep(100);
    const s2 = await page.$eval('.region-editor svg', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.move(s2.x + s2.w * 0.3, s2.y + s2.h * 0.4); await page.mouse.down(); await page.mouse.move(s2.x + s2.w * 0.6, s2.y + s2.h * 0.75, { steps: 5 }); await page.mouse.up(); await sleep(300);
    pm = await project();
    check('Región rectangular en el piso', pm.room.regions?.length === 1 && pm.room.regions[0].surface.kind === 'floor' && pm.room.regions[0].pts.length === 4);
    await page.select('.region-editor .se-ops select', 'piso-marmol'); await sleep(200);
    await clickText('.region-editor .se-ops button', 'Filete'); await sleep(200);
    await clickText('.region-editor .se-ops button', 'Duplicar'); await sleep(200);
    pm = await project();
    check('Filete redondea y Duplicar copia la región (con su material)', pm.room.regions.length === 2 && pm.room.regions[0].pts.length > 4 && pm.room.regions[1].finish?.mat === 'piso-marmol');
    await clickText('.region-editor .row-btns button', 'Aceptar'); await sleep(500);
    await clickText('.side-tab', 'Materiales'); await sleep(300);
    await page.keyboard.press('Escape');
    check('Sin errores con franjas y regiones', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S11: Editor de tamponamentos e ítems lineales (tapa arrastrada sobre varios módulos)
  {
    let pm = await project();
    const bajos = pm.modules.filter((m) => (m.y || 0) === 0 && m.params.height < 1000 && (m.rot || 0) === 0 && !m.hidden).sort((a, b) => a.x - b.x);
    const pos = (id) => page.evaluate((id) => window.__muebles.screenOf(id, 100), id);
    // sección independiente de las anteriores: vista Perspectiva, sin selección y con los demás módulos
    // ocultos (las secciones de antes dejan, por ejemplo, un placard parado delante de los bajos)
    await page.keyboard.press('Escape'); await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1200);
    const others = pm.modules.filter((m) => !m.hidden && !bajos.slice(0, 2).some((b) => b.id === m.id)).map((m) => m.id);
    const toggleOthers = async () => {
      await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
      for (const id of others) { await page.click(`.ml-row[data-id="${id}"] .ml-bulb`); await sleep(80); }
      await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
    };
    await toggleOthers();
    pm = await project();
    { const q = await pos(bajos[0].id); await page.mouse.click(q.x, q.y); await sleep(250); }
    { const q = await pos(bajos[1].id); await page.keyboard.down('Control'); await page.mouse.click(q.x, q.y); await page.keyboard.up('Control'); await sleep(250); }
    const q0 = await pos(bajos[0].id);
    await page.mouse.click(q0.x, q0.y, { button: 'right' }); await sleep(300);
    await clickText('.module-menu button', 'Editar tamponamentos'); await sleep(400);
    check('Editor de tamponamentos abierto con la selección', (await page.$eval('.tampon-editor h3', (e) => e.textContent)).includes('2 módulos'));
    await shot('07k-tamponamentos');
    const n0 = pm.modules.length;
    await clickText('.tampon-editor .row-btns button', 'Insertar ambos'); await sleep(400);
    pm = await project();
    const add = pm.modules.slice(n0);
    const span = Math.max(...bajos.slice(0, 2).map((m) => m.x + m.params.width)) - bajos[0].x;
    check('Insertar ambos: una tapa sobre los dos módulos y un lateral a cada lado', add.length === 3 && add[0].type === 'tapa' && add[0].params.width === span && add.slice(1).every((m) => m.type === 'vista'), add.map((m) => `${m.type}:${m.params.width}`).join(','));
    await clickText('.tampon-editor .row-btns button', 'Aceptar'); await sleep(300);
    for (let i = 0; i < 1; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
    check('Deshacer saca lo insertado', (await project()).modules.length === n0);
    await page.keyboard.press('Escape'); await sleep(200);
    // ítem lineal: arrastrar una tapa del catálogo pasando por dos bajos
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await clickText('.cb-groups .cb-tab', 'Tapas/Estantes'); await clickText('.cb-subs .cb-tab', 'Tapas'); await sleep(300);
    const qa = await pos(bajos[0].id), qb = await pos(bajos[1].id);
    await page.evaluate(({ qa, qb }) => {
      const btn = document.querySelector('.cb-items .mod-btn');
      const dt = new DataTransfer();
      btn.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      const vp = document.querySelector('.vp-area');
      for (const q of [qa, qb]) vp.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientX: q.x, clientY: q.y, dataTransfer: dt }));
      vp.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientX: qb.x, clientY: qb.y, dataTransfer: dt }));
      btn.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    }, { qa, qb }); await sleep(500);
    pm = await project();
    const lin = pm.modules.at(-1);
    check('Tapa arrastrada sobre dos bajos los cubre a los dos', pm.modules.length === n0 + 1 && lin.type === 'tapa' && lin.params.width === span && lin.x === bajos[0].x, `${lin.type} ${lin.x} ${lin.params.width} (span ${span})`);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    await page.keyboard.press('Escape');
    await toggleOthers();
    check('Los demás módulos vuelven a verse', (await project()).modules.filter((m) => others.includes(m.id)).every((m) => !m.hidden));
    check('Sin errores con tamponamentos', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S12: geometrías (rectangular en el piso, lineal, sobre una pared) y propiedades
  {
    let pm = await project();
    const at = (x, z, y = 0) => page.evaluate((x, z, y) => window.__muebles.screenOfPoint(x, z, y), x, z, y);
    const xs = pm.room.nodes.map((n) => n.x), zs = pm.room.nodes.map((n) => n.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, fz = Math.max(...zs);
    const n0 = (pm.geometries || []).length;
    await page.select('.vp-geometry', 'rect'); await sleep(200);
    check('Geometría: aparece el panel de construcción', !!(await page.$('.geo-hud')));
    let a = await at(cx - 400, fz - 1000), b = await at(cx + 200, fz - 600);
    await page.mouse.click(a.x, a.y); await sleep(150); await page.mouse.move(b.x, b.y); await sleep(150); await page.mouse.click(b.x, b.y); await sleep(400);
    pm = await project();
    const rg = pm.geometries?.[n0];
    check('Rectangular en el piso: dos clics', rg?.kind === 'rect' && rg.plane.kind === 'floor' && rg.height === 150);
    check('Queda seleccionada con sus propiedades', !!(await page.$('.geometry-panel')));
    const hIn = await page.evaluateHandle(() => [...document.querySelectorAll('.geometry-panel .field')].find((f) => f.textContent.startsWith('Altura'))?.querySelector('input'));
    await hIn.click({ count: 3 }); await hIn.type('900'); await page.keyboard.press('Enter'); await sleep(300);
    check('Altura desde Propiedades', (await project()).geometries[n0].height === 900);
    await page.evaluate(() => { const cb = [...document.querySelectorAll('.geometry-panel .check')].find((l) => l.textContent.includes('Presupuestado')); cb.querySelector('input').click(); }); await sleep(200);
    const pIn = await page.evaluateHandle(() => [...document.querySelectorAll('.geometry-panel .field')].find((f) => f.textContent.startsWith('Precio'))?.querySelector('input'));
    await pIn.click({ count: 3 }); await pIn.type('12345'); await page.keyboard.press('Enter'); await sleep(300);
    await shot('07l-geometria');
    await page.keyboard.press('Escape');
    // lineal: dos puntos y clic derecho → diálogo
    await page.select('.vp-geometry', 'lineal'); await sleep(200);
    a = await at(cx - 1200, fz - 900); b = await at(cx + 800, fz - 900);
    await page.mouse.click(a.x, a.y); await sleep(150); await page.mouse.move(b.x, b.y); await sleep(100); await page.mouse.click(b.x, b.y); await sleep(150);
    await page.mouse.click(b.x, b.y, { button: 'right' }); await sleep(300);
    check('Al terminar la lineal aparece su diálogo', !!(await page.$('.lineal-dialog')));
    await clickText('.lineal-dialog button', 'Finalizar'); await sleep(300);
    pm = await project();
    check('Lineal creada sobre el piso', pm.geometries.some((g) => g.kind === 'lineal' && g.pts.length === 2));
    // rectangular sobre la pared del fondo: clic derecho en la pared elige el plano
    const nz = (id) => pm.room.nodes.find((n) => n.id === id).z;
    const back = [...pm.room.walls].sort((x, y) => (nz(x.n0) + nz(x.n1)) - (nz(y.n0) + nz(y.n1)))[0];
    await page.select('.vp-geometry', 'rect'); await sleep(200);
    const w1 = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), back.id);
    await page.mouse.click(w1.x, w1.y, { button: 'right' }); await sleep(200);
    check('Clic derecho en una pared la toma como plano', (await page.$eval('.geo-hud', (e) => e.textContent)).includes('plano: pared'));
    await page.mouse.click(w1.x - 80, w1.y - 30); await sleep(150); await page.mouse.move(w1.x + 60, w1.y + 30); await sleep(100); await page.mouse.click(w1.x + 60, w1.y + 30); await sleep(400);
    pm = await project();
    check('Rectangular sobre la pared', pm.geometries.some((g) => g.plane.kind === 'wall' && g.plane.wallId === back.id));
    await page.keyboard.press('Escape');
    await clickText('.tabs button', 'Presupuesto'); await sleep(500);
    check('La geometría presupuestada aparece en el presupuesto', (await page.evaluate(() => document.body.innerText)).includes('Geometrías'));
    await clickText('.tabs button', 'Diseño 3D'); await sleep(800);
    check('Sin errores con las geometrías', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S13: Perforar (geometría que agujerea la pared) y área húmeda sobre una tapa
  {
    let pm = await project();
    const nz = (id) => pm.room.nodes.find((n) => n.id === id).z;
    const back = [...pm.room.walls].sort((x, y) => (nz(x.n0) + nz(x.n1)) - (nz(y.n0) + nz(y.n1)))[0];
    await page.select('.vp-geometry', 'circ'); await sleep(200);
    const w1 = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2300, -2), back.id);
    await page.mouse.click(w1.x + 120, w1.y, { button: 'right' }); await sleep(200);
    await page.mouse.click(w1.x + 120, w1.y); await sleep(150); await page.mouse.move(w1.x + 160, w1.y); await sleep(100); await page.mouse.click(w1.x + 160, w1.y); await sleep(400);
    pm = await project();
    const circ = pm.geometries.at(-1);
    check('Circular sobre la pared', circ.kind === 'circ' && circ.plane.kind === 'wall');
    await page.mouse.click(w1.x + 120, w1.y, { button: 'right' }); await sleep(300);
    await clickText('.geo-menu button', 'Perforar'); await sleep(500);
    pm = await project();
    check('Clic derecho → Perforar: la geometría agujerea la pared', pm.geometries.find((g) => g.id === circ.id)?.hole?.on === true);
    await shot('07m-perforar-pared');
    const depthIn = await page.evaluateHandle(() => [...document.querySelectorAll('.geometry-panel .field')].find((f) => f.textContent.startsWith('Profundidad'))?.querySelector('input'));
    check('Perforante: profundidad (vacía = pasante)', !!depthIn && (await depthIn.evaluate((e) => e.placeholder)) === 'pasante');
    await page.keyboard.press('Escape');
    check('Sin errores al perforar', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S14: Línea Gola (biblioteca Cocina Gola, sin tiradores)
  {
    const n0 = (await project()).modules.length;
    await clickText('.cb-libs .cb-tab', 'Cocina Gola'); await sleep(300);
    check('Biblioteca Cocina Gola', (await page.$$eval('.cb-groups .cb-tab', (b) => b.map((x) => x.textContent))).join('|') === 'Inferiores|Altos');
    await clickText('.cb-subs .cb-tab', 'Cajoneros'); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.mod-btn')].find((b) => b.textContent.includes('Cajonero gola 3'))?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))); await sleep(500);
    const pm = await project();
    const g = pm.modules.at(-1);
    check('Cajonero gola insertado con gola arriba y entre cajones', pm.modules.length === n0 + 1 && g.params.gola === 'superior_medio' && g.params.handlePos === 'none');
    const golaF = await page.$$eval('.inspector .field', (fs) => fs.find((f) => f.textContent.startsWith('Gola'))?.querySelector('select')?.value);
    check('Propiedades muestra la Gola del módulo', golaF === 'superior_medio', golaF);
    await shot('07n-gola');
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    await page.keyboard.press('Escape');
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await sleep(200);
    check('Sin errores con la Línea Gola', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S15: biblioteca Salas y familias Puertas/Frentes, Puertas Extras, Cajas, Composición
  {
    const dblItem = (t) => page.evaluate((t) => [...document.querySelectorAll('.mod-btn')].find((b) => b.textContent.includes(t))?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), t);
    const n0 = (await project()).modules.length;
    await clickText('.cb-libs .cb-tab', 'Salas'); await sleep(300);
    check('Biblioteca Salas', (await page.$$eval('.cb-groups .cb-tab', (b) => b.map((x) => x.textContent))).join('|') === 'Racks|Bibliotecas|Aparadores|Paneles');
    await dblItem('Rack de TV'); await sleep(400);
    check('Rack de TV insertado', (await project()).modules.at(-1).type === 'rack_tv');
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await sleep(200);
    const groups = await page.$$eval('.cb-groups .cb-tab', (b) => b.map((x) => x.textContent));
    check('Cocinas tiene Puertas/Frentes, Puertas Extras, Cajas y Composición', ['Puertas/Frentes', 'Puertas Extras', 'Cajas', 'Composición'].every((g) => groups.includes(g)), groups.join('|'));
    await clickText('.cb-groups .cb-tab', 'Composición'); await sleep(300);
    await dblItem('Cocina lineal 2,40'); await sleep(600);
    const pm = await project();
    const comp = pm.modules.slice(n0 + 1);
    check('Composición: inserta los 6 módulos juntos y agrupados', comp.length === 6 && new Set(comp.map((m) => m.groupId)).size === 1 && !!comp[0].groupId, `${comp.length} módulos`);
    await shot('07o-composicion');
    for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
    check('Deshacer saca la composición y el rack', (await project()).modules.length === n0);
    await page.keyboard.press('Escape');
    await clickText('.cb-groups .cb-tab', 'Inferiores'); await sleep(200);
    check('Sin errores con Salas y Composición', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S16: Decore (decoración paramétrica propia) y material "en todos de este tipo"
  {
    const dblItem = (t) => page.evaluate((t) => [...document.querySelectorAll('.mod-btn')].find((b) => b.textContent.includes(t))?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), t);
    const n0 = (await project()).modules.length;
    await clickText('.cb-libs .cb-tab', 'Decore'); await sleep(300);
    await clickText('.cb-subs .cb-tab', 'Sillas'); await sleep(200);
    await dblItem('Silla'); await sleep(300); await dblItem('Silla'); await sleep(400);
    let pm = await project();
    check('Decore: sillas insertadas', pm.modules.slice(n0).filter((m) => m.type === 'silla').length === 2);
    const sel = await page.$$eval('.inspector .field', (fs) => { const f = fs.find((x) => x.textContent.startsWith('Material')); return f ? [...f.querySelectorAll('option')].map((o) => o.value) : []; });
    check('Material elegible en Propiedades', sel.includes('madera_osc'));
    await page.evaluate(() => { const f = [...document.querySelectorAll('.inspector .field')].find((x) => x.textContent.startsWith('Material')); const s = f.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'negro'); s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
    await clickText('.inspector button', 'Material en todos de este tipo'); await sleep(300);
    pm = await project();
    check('"En todos de este tipo": las dos sillas quedan negras', pm.modules.filter((m) => m.type === 'silla').every((m) => m.params.material === 'negro'));
    await shot('07p-decore');
    for (let i = 0; i < 4; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    check('Deshacer saca las sillas', (await project()).modules.length === n0, String((await project()).modules.length - n0));
    await page.keyboard.press('Escape');
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await sleep(200);
    check('Sin errores con Decore', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S17: Lumen y Editor de luces
  {
    const dblItem = (t) => page.evaluate((t) => [...document.querySelectorAll('.mod-btn')].find((b) => b.textContent.includes(t))?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), t);
    const n0 = (await project()).modules.length;
    await clickText('.cb-libs .cb-tab', 'Lumen'); await sleep(300);
    await clickText('.cb-subs .cb-tab', 'Spots'); await sleep(200); await dblItem('Spot embutido'); await sleep(400);
    let pm = await project();
    check('Lumen: spot embutido en el techo', pm.modules.length === n0 + 1 && pm.modules.at(-1).type === 'spot_embutido' && pm.modules.at(-1).y > 2400);
    await page.keyboard.press('Escape');
    await clickText('.vp-toolbar button', 'Luces'); await sleep(300);
    check('Editor de luces lista la luminaria', (await page.$$eval('.lights-editor .le-item', (x) => x.length)) >= 1);
    const ap = await page.evaluateHandle(() => [...document.querySelectorAll('.lights-editor .field')].find((f) => f.textContent.startsWith('Apertura'))?.querySelector('input'));
    await ap.click({ count: 3 }); await ap.type('60'); await page.keyboard.press('Enter'); await sleep(300);
    pm = await project();
    check('Apertura del spot desde el Editor de luces', pm.modules.at(-1).params.beam === 60);
    await clickText('.vp-toolbar button', 'Modo render'); await sleep(1500);
    await shot('07q-lumen');
    check('Sin errores con las luces en Modo render', errors.length === 0, errors.slice(-3).join(' | '));
    await clickText('.vp-toolbar button', '✓ Modo render'); await sleep(300);
    await clickText('.lights-editor .icon-btn', '✕'); await sleep(200);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200);
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await sleep(200);
  }

  // Fase 7b S18: paredes curvas (Flecha en Propiedades y Mover HotPoint con H)
  {
    await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
    let pm = await project();
    const nx = (id) => pm.room.nodes.find((n) => n.id === id).x;
    const right = [...pm.room.walls].sort((a, b) => (nx(b.n0) + nx(b.n1)) - (nx(a.n0) + nx(a.n1)))[0];
    const A = pm.room.nodes.find((n) => n.id === right.n0), B = pm.room.nodes.find((n) => n.id === right.n1);
    await page.keyboard.press('KeyH'); await sleep(300);
    check('H activa Mover HotPoint', (await page.$eval('.vp-toolbar .nav-tool.active', (e) => e.textContent).catch(() => '')) === 'HotPoint');
    const mid = await page.evaluate((x, z, y) => window.__muebles.screenOfPoint(x, z, y), (A.x + B.x) / 2, (A.z + B.z) / 2, pm.room.h + 30);
    await page.mouse.move(mid.x, mid.y); await page.mouse.down();
    for (let i = 1; i <= 10; i++) { await page.mouse.move(mid.x + 6 * i, mid.y); await sleep(30); }
    await page.mouse.up(); await sleep(500);
    pm = await project();
    const fl = pm.room.walls.find((w) => w.id === right.id).flecha;
    check('Arrastrar el hotpoint curva la pared (flecha hacia afuera)', fl > 100, String(fl));
    await shot('07r-pared-curva');
    await page.keyboard.press('KeyM'); await sleep(200);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    check('Deshacer endereza la pared', !(await project()).room.walls.find((w) => w.id === right.id).flecha);
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(800);
    check('Sin errores con paredes curvas', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S19: 30-40-50, extremos, Dry Wall y Bloquear ángulo
  {
    await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
    let pm = await project();
    const w = pm.room.walls[1];
    // tramo más largo de la pared sin aberturas (una ventana en el punto le gana al clic)
    const wlen = await page.evaluate((id) => { const p = JSON.parse(localStorage.getItem('mueblesapp.project')); const wl = p.room.walls.find((x) => x.id === id); const a = p.room.nodes.find((n) => n.id === wl.n0), b = p.room.nodes.find((n) => n.id === wl.n1); return Math.hypot(b.x - a.x, b.z - a.z); }, w.id);
    const cuts = [0, ...pm.room.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.offset - b.offset).flatMap((o) => [o.offset, o.offset + o.width]), wlen];
    let wu = wlen / 2, bestL = -1;
    for (let i = 0; i + 1 < cuts.length; i += 2) if (cuts[i + 1] - cuts[i] > bestL) { bestL = cuts[i + 1] - cuts[i]; wu = (cuts[i] + cuts[i + 1]) / 2; }
    const wp = await page.evaluate((id, u) => {
      const p = JSON.parse(localStorage.getItem('mueblesapp.project'));
      const wl = p.room.walls.find((x) => x.id === id);
      const a = p.room.nodes.find((n) => n.id === wl.n0), b = p.room.nodes.find((n) => n.id === wl.n1);
      const L = Math.hypot(b.x - a.x, b.z - a.z), d = [(b.x - a.x) / L, (b.z - a.z) / L], nrm = [d[1], -d[0]];
      return window.__muebles.screenOfPoint(a.x + d[0] * u + nrm[0] * 75, a.z + d[1] * u + nrm[1] * 75, 2000);
    }, w.id, wu);
    await page.mouse.click(wp.x, wp.y, { button: 'right' }); await sleep(400);
    await clickText('.wall-menu button', '30-40-50'); await sleep(300);
    check('30-40-50 abre su diálogo (300/400/500 → 90°)', (await page.$eval('.dlg-304-ang', (e) => e.textContent)) === 'Ángulo de la esquina: 90°');
    const cIn = await page.evaluateHandle(() => [...document.querySelectorAll('.dlg-304050 .field')].find((f) => f.textContent.startsWith('C'))?.querySelector('input'));
    await cIn.click({ count: 3 }); await cIn.type('560'); await sleep(200);
    const ang = await page.$eval('.dlg-304-ang', (e) => e.textContent);
    await clickText('.dlg-304050 button', 'Aplicar'); await sleep(400);
    const pm2 = await project();
    check('Aplicar gira la pared al ángulo medido', ang.includes('°') && JSON.stringify(pm2.room.nodes) !== JSON.stringify(pm.room.nodes), ang);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    await page.mouse.click(wp.x, wp.y); await sleep(400);
    const ext = await page.evaluateHandle(() => [...document.querySelectorAll('.inspector .field')].find((f) => f.textContent.startsWith('Extremo final'))?.querySelector('input'));
    await ext.click({ count: 3 }); await ext.type('300'); await page.keyboard.press('Enter'); await sleep(300);
    check('Extremo final de la pared', (await project()).room.walls[1].extFin === 300);
    await page.evaluate(() => { const f = [...document.querySelectorAll('.inspector .field')].find((x) => x.textContent.startsWith('Tipo de pared')); const s = f.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'drywall'); s.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(300);
    check('Tipo de pared: Dry Wall', (await project()).room.walls[1].tipo === 'drywall');
    for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
    await page.keyboard.press('Escape');
    await clickText('.vp-toolbar button', '✏ Paredes'); await sleep(500);
    check('Construir paredes tiene Bloquear ángulo y Referencia', !!(await page.$('.draw-hud .dh-ref')) && (await page.$eval('.draw-hud', (e) => e.textContent)).includes('Bloquear ángulo'));
    await page.keyboard.press('Escape'); await sleep(300);
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(800);
    check('Sin errores con el editor de paredes', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S20: piso (menú del clic derecho, piso padrón, ajustar límites, grilla que atrae)
  {
    let pm = await project();
    const xs = pm.room.nodes.map((n) => n.x), zs = pm.room.nodes.map((n) => n.z);
    const fp = await page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z, 0), (Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...zs) - 300);
    await page.mouse.click(fp.x, fp.y, { button: 'right' }); await sleep(300);
    check('Clic derecho en el piso abre su menú', (await page.$$eval('.floor-menu button', (b) => b.length).catch(() => 0)) === 4);
    await clickText('.floor-menu button', 'Crear piso padrón'); await sleep(400);
    pm = await project();
    check('Piso padrón de 5000 × 5000', pm.room.floor?.auto === false && pm.room.floor.pts[1][0] - pm.room.floor.pts[0][0] === 5000);
    await page.mouse.click(fp.x, fp.y, { button: 'right' }); await sleep(300);
    await clickText('.floor-menu button', 'Ajustar límites'); await sleep(400);
    check('Ajustar límites: el piso vuelve a seguir las paredes', (await project()).room.floor?.auto === true);
    await page.mouse.click(fp.x, fp.y, { button: 'right' }); await sleep(300);
    await clickText('.floor-menu button', 'Editar grilla'); await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.floor-grid-editor .check input')].forEach((i) => i.click())); await sleep(300);
    await shot('07s-grilla-piso');
    await clickText('.floor-grid-editor button', 'Cerrar'); await sleep(300);
    pm = await project();
    check('Grilla del piso: mostrar y atraer', pm.room.floor.grid?.show && pm.room.floor.grid?.attract);
    for (let i = 0; i < 4; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    check('Sin errores con el piso', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S21: Reglas de pared (grupo, Mostrar → Grilla y reglas, atracción de alturas)
  {
    await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
    let pm = await project();
    const nz = (id) => pm.room.nodes.find((n) => n.id === id).z;
    const back = [...pm.room.walls].sort((a, b) => (nz(a.n0) + nz(a.n1)) - (nz(b.n0) + nz(b.n1)))[0];
    const wp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2000, 75), back.id);
    await page.mouse.click(wp.x, wp.y, { button: 'right' }); await sleep(400);
    await clickText('.wall-menu button', 'Reglas'); await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll('.rulers-dialog .rl-groups .radio')].find((l) => l.textContent.includes('Cocina')).querySelector('input').click()); await sleep(300);
    check('Reglas: la pared toma el grupo Cocina', (await project()).room.walls.find((w) => w.id === back.id).rulerGroup === 'cocina');
    await clickText('.rulers-dialog .row-btns button', 'Cerrar'); await sleep(200);
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(900);
    if (!(await page.$('.sb-menu'))) await clickText('.sb-show button', 'Mostrar'); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.sb-menu label')].find((l) => l.textContent.includes('Grilla y reglas')).querySelector('input').click()); await sleep(600);
    check('Mostrar → Grilla y reglas dibuja las reglas', (await page.$$('.ruler-label')).length >= 4);
    await shot('07t-reglas');
    pm = await project();
    const al = pm.modules.filter((m) => m.type === 'alacena').at(-1);
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), al.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    await page.keyboard.press('PageUp'); await sleep(250); await page.keyboard.press('PageUp'); await sleep(250);
    const y2 = (await project()).modules.find((m) => m.id === al.id).y;
    check('Las reglas atraen: subir 20 mm desde 1450 vuelve a la regla', y2 === al.y || y2 === 1450, `${al.y} → ${y2}`);
    await page.keyboard.press('Escape');
    for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    if (!(await page.$('.sb-menu'))) await clickText('.sb-show button', 'Mostrar'); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.sb-menu label')].find((l) => l.textContent.includes('Grilla y reglas')).querySelector('input').click()); await sleep(300);
    check('Sin errores con las reglas', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S22: inserción (dirección, Desasociar, cambiar de plano con clic derecho al arrastrar)
  {
    let pm = await project();
    const al = pm.modules.filter((m) => m.type === 'alacena').at(-1);
    let q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), al.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    await page.select('.vp-insert-dir', 'izquierda'); await sleep(200);
    const first = await page.$('.cb-items .mod-btn');
    await first.click({ count: 2 }); await sleep(500);
    let pn = await project();
    const nu = pn.modules.find((m) => !pm.modules.some((o) => o.id === m.id));
    check('Dirección de inserción: el ítem nuevo queda a la izquierda del seleccionado', nu && nu.x + nu.params.width === al.x && nu.y === al.y, nu && `${nu.x}+${nu.params.width} vs ${al.x}`);
    await page.select('.vp-insert-dir', ''); await sleep(100);
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), al.id);
    await page.mouse.click(q.x, q.y, { button: 'right' }); await sleep(300);
    await clickText('.module-menu button', 'Desasociar'); await sleep(300);
    check('Desasociar: el módulo deja su plano', (await project()).modules.find((m) => m.id === al.id).detached === true);
    // punto del piso lejos de todos los módulos (las secciones anteriores dejan módulos movidos)
    const fp = await page.evaluate((alId) => {
      const p = JSON.parse(localStorage.getItem('mueblesapp.project'));
      const xs = p.room.nodes.map((n) => n.x), zs = p.room.nodes.map((n) => n.z);
      const boxes = p.modules.filter((m) => m.id !== alId && !m.hidden).map((m) => { const r = (m.rot || 0) % 180 !== 0; const fw = r ? m.params.depth : m.params.width, fd = r ? m.params.width : m.params.depth; return [m.x, m.z, m.x + fw, m.z + fd]; });
      let best = null;
      for (let x = Math.min(...xs) + 400; x <= Math.max(...xs) - 400; x += 100) for (let z = Math.min(...zs) + 400; z <= Math.max(...zs) - 300; z += 100) {
        const d = Math.min(...boxes.map(([x0, z0, x1, z1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1))), 1e9);
        if (!best || d > best.d || (d === best.d && z > best.z)) best = { x, z, d };
      }
      return window.__muebles.screenOfPoint(best.x, best.z, 0);
    }, al.id);
    await page.mouse.move(q.x, q.y); await page.mouse.down(); await page.mouse.move(q.x + 20, q.y + 20, { steps: 4 }); await page.mouse.move(fp.x, fp.y, { steps: 8 }); await sleep(200);
    await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await sleep(200);
    await page.mouse.up(); await sleep(400);
    const a2 = (await project()).modules.find((m) => m.id === al.id);
    check('Clic derecho al arrastrar: la alacena pasa al plano del piso', a2.y === 0 && !a2.detached, `y=${a2.y}`);
    await shot('07u-cambio-plano');
    for (let i = 0; i < 3; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(250); }
    check('Deshacer vuelve la alacena a su lugar', (await project()).modules.find((m) => m.id === al.id).y === al.y);
    check('Sin errores con la inserción', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S23: Módulos favoritos (guardar con nombre e imagen, insertar, quitar)
  {
    const pm = await project();
    const al = pm.modules.filter((m) => m.type === 'alacena').at(-1);
    const q = await page.evaluate((id) => window.__muebles.screenOf(id, 100), al.id);
    await page.mouse.click(q.x, q.y); await sleep(300);
    await page.mouse.click(q.x, q.y, { button: 'right' }); await sleep(300);
    await clickText('.module-menu button', 'Agregar a favoritos'); await sleep(900);
    await page.type('.favorite-dialog input', 'Alacena e2e');
    check('Favorito: la imagen es la vista actual', ((await page.$eval('.fav-preview', (i) => i.src).catch(() => '')) || '').startsWith('data:image/jpeg'));
    await clickText('.favorite-dialog button', 'Guardar'); await sleep(500);
    check('Favoritos: aparece en la pestaña ♥ Favoritos', (await page.$$eval('.cb-items .mod-btn span', (s) => s.map((x) => x.textContent))).includes('Alacena e2e'));
    await shot('07v-favoritos');
    const ib = await page.$('.cb-items .mod-btn'); await ib.click({ count: 2 }); await sleep(500);
    const nu = (await project()).modules.filter((m) => !pm.modules.some((o) => o.id === m.id));
    check('Insertar un favorito copia medidas y materiales', nu.length === 1 && nu[0].params.width === al.params.width && JSON.stringify(nu[0].mats) === JSON.stringify(al.mats));
    await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
    await page.click('.cb-items .fav-del'); await sleep(300);
    check('Quitar de favoritos', (await page.$$('.cb-items .mod-btn')).length === 0);
    await clickText('.cb-tab', 'Cocinas'); await sleep(300);
    check('Sin errores con los favoritos', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S33: Preferencias, Configurar atajos y menú Mostrar
  {
    const ui = () => page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.ui')));
    const col0 = (await ui()).collision !== false;
    await clickText('.top-actions button', 'Preferencias'); await sleep(300);
    const fieldIn = (txt) => page.evaluateHandle((txt) => [...document.querySelectorAll('.prefs-dialog .field')].find((f) => f.textContent.includes(txt)).querySelector('input'), txt);
    let step = await fieldIn('Paso de las flechas');
    await step.click({ count: 3 }); await step.type('25'); await page.keyboard.press('Enter'); await sleep(200);
    check('Preferencias: paso de flechas 25 mm', (await ui()).moveStep === 25 && (await ui()).prefs?.arrowStep === 25);
    await clickText('.pd-tabs button', 'Configurar atajos'); await sleep(200);
    await page.click('tr[data-action="collision"] td:nth-child(2) button'); await sleep(200);
    await page.keyboard.press('k'); await sleep(300);
    check('Atajo propio: Colisión = K', (await ui()).shortcuts?.collision === 'K');
    await shot('08e-atajos');
    await clickText('.prefs-dialog .row-btns button', 'Cerrar'); await sleep(300);
    await page.mouse.move(700, 700);
    await page.keyboard.press('k'); await sleep(300);
    check('K cambia la colisión', ((await ui()).collision !== false) === !col0);
    await page.keyboard.press('b'); await sleep(300);
    check('B quedó libre (no hace nada)', ((await ui()).collision !== false) === !col0);
    await page.keyboard.press('k'); await sleep(300);
    if (!(await page.$('.sb-menu'))) await clickText('.sb-show button', 'Mostrar'); await sleep(200);
    const items = await page.$$eval('.sb-menu label', (l) => l.map((x) => x.textContent.trim()));
    check('Mostrar: planos, flechas, hotpoints, inserción, invisibles', ['Planos importados', 'Flechas de medidas', 'HotPoints', 'Posición de inserción', 'Módulos invisibles'].every((t) => items.includes(t)));
    await page.evaluate(() => [...document.querySelectorAll('.sb-menu label')].find((l) => l.textContent.includes('Flechas de medidas')).querySelector('input').click()); await sleep(300);
    check('Mostrar → sin flechas de medidas', (await ui()).show?.flechas === false);
    await page.evaluate(() => [...document.querySelectorAll('.sb-menu label')].find((l) => l.textContent.includes('Flechas de medidas')).querySelector('input').click()); await sleep(300);
    // dejar todo como estaba
    await clickText('.top-actions button', 'Preferencias'); await sleep(300);
    step = await fieldIn('Paso de las flechas');
    await step.click({ count: 3 }); await step.type('10'); await page.keyboard.press('Enter'); await sleep(200);
    await clickText('.pd-tabs button', 'Configurar atajos'); await sleep(200);
    await page.click('tr[data-action="collision"] td:nth-child(3) button'); await sleep(200);
    await clickText('.prefs-dialog .row-btns button', 'Cerrar'); await sleep(300);
    check('Atajos y paso vuelven a lo normal', !(await ui()).shortcuts?.collision && (await ui()).moveStep === 10);
    check('Sin errores con preferencias y atajos', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Fase 7b S32: Importar planta DXF (referencia y paredes) e importar modelo 3D (OBJ)
  {
    const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muebles-e2e-'));
    const L = (x0, y0, x1, y1, l = 'MUROS') => ['0', 'LINE', '8', l, '10', x0, '20', y0, '11', x1, '21', y1];
    fs.writeFileSync(path.join(dir, 'planta.dxf'), ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES',
      ...L(0, 0, 4000, 0), ...L(4000, 0, 4000, 3000), ...L(4000, 3000, 0, 3000), ...L(0, 3000, 0, 0),
      '0', 'CIRCLE', '8', 'MESA', '10', '2000', '20', '1500', '40', '500', '0', 'ENDSEC', '0', 'EOF'].join('\n'));
    fs.writeFileSync(path.join(dir, 'caja.obj'), ['v 0 0 0', 'v 0.5 0 0', 'v 0.5 0.8 0', 'v 0 0.8 0', 'v 0 0 0.5', 'v 0.5 0 0.5', 'v 0.5 0.8 0.5', 'v 0 0.8 0.5', 'f 1 2 3 4', 'f 5 6 7 8', 'f 1 2 6 5', 'f 2 3 7 6', 'f 3 4 8 7', 'f 4 1 5 8'].join('\n'));
    const room0 = (await project()).room;
    const [dxfIn, objIn] = await page.$$('.vp-toolbar input[type=file]');
    await dxfIn.uploadFile(path.join(dir, 'planta.dxf')); await sleep(800);
    check('DXF: diálogo con capas y medidas', (await page.$eval('.dxf-opts .hint', (h) => h.textContent).catch(() => '')).startsWith('4000 × 3000') && (await page.$$('.dxf-opts .check')).length === 2);
    await clickText('.dxf-dialog .row-btns button', 'Importar'); await sleep(600);
    check('DXF como dibujo de referencia', ((await project()).planDxf?.segments.length || 0) >= 4);
    await objIn.uploadFile(path.join(dir, 'caja.obj')); await sleep(1200);
    const ex = (await project()).externals || [];
    check('Modelo 3D OBJ importado como entidad externa', ex.length === 1 && ex[0].format === 'obj');
    await page.evaluate(() => { const i = document.querySelector('.externals-panel .ext-item[data-id] select'); i.value = 'm'; i.dispatchEvent(new Event('change', { bubbles: true })); }); await sleep(400);
    check('Unidades del modelo: metros', (await project()).externals[0].units === 'm');
    await shot('08d-importados');
    await dxfIn.uploadFile(path.join(dir, 'planta.dxf')); await sleep(800);
    await page.evaluate(() => document.querySelectorAll('.dxf-opts input[name=dxfmode]')[1].click()); await sleep(200);
    await page.evaluate(() => [...document.querySelectorAll('.dxf-opts .check')].find((l) => l.textContent.includes('MESA')).querySelector('input').click()); await sleep(200);
    await clickText('.dxf-dialog .row-btns button', 'Importar'); await sleep(800);
    const r = (await project()).room;
    check('DXF convertido en paredes (4 paredes de 4000 × 3000)', r.walls.length === 4 && Math.max(...r.nodes.map((n) => n.x)) === 4000 && Math.max(...r.nodes.map((n) => n.z)) === 3000);
    const dirty = async () => { const q = await project(); return JSON.stringify(q.room.nodes) !== JSON.stringify(room0.nodes) || (q.externals || []).length > 0 || !!q.planDxf; };
    for (let i = 0; i < 25 && (await dirty()); i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    check('Deshacer vuelve el ambiente y saca lo importado', JSON.stringify((await project()).room.nodes) === JSON.stringify(room0.nodes) && !((await project()).externals || []).length);
    await clickText('.externals-panel .icon-btn', '✕'); await sleep(200);
    fs.rmSync(dir, { recursive: true, force: true });
    check('Sin errores al importar', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Seguridad: un proyecto importado no hace que la app vaya a buscar nada afuera; y si el
  // almacenamiento del navegador se llena, se avisa en vez de perder cambios en silencio.
  {
    const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'muebles-e2e-'));
    const backup = await project();
    const evil = { ...backup, name: 'Importado', planImage: { src: 'https://evil.example/plano.png', x: 0, z: 0, wPx: 100, hPx: 100, mmPerPx: 10, visible: true },
      render: { ...(backup.render || {}), background: { mode: 'imagen', image: 'data:image/png,")}body{background:red' } } };
    fs.writeFileSync(path.join(dir, 'evil.mueble.json'), JSON.stringify(evil));
    const outside = [];
    const onReq = (r) => { if (/evil\.example/.test(r.url())) outside.push(r.url()); };
    page.on('request', onReq);
    const projIn = await page.$('.top-actions input[type=file][accept=".json"]');
    await projIn.uploadFile(path.join(dir, 'evil.mueble.json')); await sleep(1200);
    const imp = await project();
    check('Proyecto importado: el plano con dirección externa se descarta', imp.name === 'Importado' && imp.planImage == null);
    check('Proyecto importado: el fondo del render con CSS inyectado se descarta', !imp.render?.background?.image);
    await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
    check('La app no pidió nada a la dirección externa', outside.length === 0, outside.join(' '));
    page.off('request', onReq);
    await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(800);
    // almacenamiento lleno: un cambio no entra → aviso con "Guardar archivo"
    // el navegador tira QuotaExceededError cuando no entra: lo simulamos para el proyecto
    await page.evaluate(() => {
      window.__origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'mueblesapp.project') throw new DOMException('quota', 'QuotaExceededError'); return window.__origSet.call(this, k, v); };
    });
    await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
    await page.click('.ml-row'); await sleep(200);
    await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
    await page.keyboard.press('KeyO'); await sleep(500); // ocultar el módulo: un cambio seguro
    const alertTxt = await page.$eval('.storage-alert', (e) => e.textContent).catch(() => '');
    check('Almacenamiento lleno: aparece el aviso con "Guardar archivo"', /No se pudo guardar|casi lleno/.test(alertTxt) && alertTxt.includes('Guardar archivo'), alertTxt.slice(0, 80));
    await shot('09a-aviso-guardado');
    await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
    await page.keyboard.press('KeyO'); await sleep(500); // volver a mostrarlo
    check('Con lugar de nuevo, el aviso se va y se guarda', !(await page.$('.storage-alert.error')));
    await page.keyboard.press('Escape');
    // volver al proyecto de antes
    fs.writeFileSync(path.join(dir, 'antes.mueble.json'), JSON.stringify(backup));
    await projIn.uploadFile(path.join(dir, 'antes.mueble.json')); await sleep(1200);
    check('Se recupera el proyecto de antes', (await project()).name === backup.name && (await project()).modules.length === backup.modules.length);
    fs.rmSync(dir, { recursive: true, force: true });
    check('Sin errores en las pruebas de seguridad', errors.filter((e) => !/QuotaExceeded|quota/i.test(e)).length === 0, errors.slice(-3).join(' | '));
  }

  // #174 Encastre: bacha sobre el bajo bacha y horno en la torre; acompañan al mueble.
  // Modelos: con varios módulos elegidos arranca en Selección y cambia todos.
  {
    const n0 = (await project()).modules.length;
    const pickList = async (ids, ctrl = false) => {
      await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
      for (const [i, id] of ids.entries()) {
        if (ctrl || i > 0) await page.keyboard.down('Control');
        await page.click(`.ml-row[data-id="${id}"]`); await sleep(150);
        if (ctrl || i > 0) await page.keyboard.up('Control');
      }
      await clickText('.side-tab', 'Lista de Módulos'); await sleep(300);
    };
    let pm = await project();
    const bb = pm.modules.find((m) => m.type === 'bajo_bacha' && !m.hidden);
    await page.keyboard.press('Escape');
    await pickList([bb.id]);
    await clickText('.cb-libs .cb-tab', 'Accesorios'); await clickText('.cb-groups .cb-tab', 'Bachas'); await clickText('.cb-subs .cb-tab', 'De apoyo'); await sleep(300);
    await (await page.$('.cb-items .mod-btn')).click({ count: 2 }); await sleep(600);
    pm = await project();
    const sink = pm.modules.find((m) => m.type === 'bacha' && m.hostId === bb.id);
    const mid = (m) => m.x + (m.rot % 180 ? m.params.depth : m.params.width) / 2;
    check('Bacha encastrada: centrada sobre la mesada del bajo bacha', !!sink && Math.abs(mid(sink) - mid(bb)) <= 1 && sink.y === bb.params.height + bb.params.mesadaT, sink && `${sink.x} y=${sink.y}`);
    await page.keyboard.press('Escape');
    await pickList([bb.id]);
    const bb0 = (await project()).modules.find((m) => m.id === bb.id);
    for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowDown'); await sleep(150); }
    pm = await project();
    const bb1 = pm.modules.find((m) => m.id === bb.id), sink1 = pm.modules.find((m) => m.id === sink.id);
    check('Mover el bajo bacha mueve la bacha', bb1.z !== bb0.z && sink1.z - sink.z === bb1.z - bb0.z, `${bb1.z - bb0.z} / ${sink1.z - sink.z}`);
    await page.keyboard.press('Escape');
    await clickText('.cb-libs .cb-tab', 'Cocinas'); await clickText('.cb-groups .cb-tab', 'Altos'); await clickText('.cb-subs .cb-tab', 'Módulos p/Electrodomésticos'); await sleep(300);
    await (await page.$('.cb-items .mod-btn')).click({ count: 2 }); await sleep(700);
    const torre = (await project()).modules.at(-1);
    await clickText('.cb-libs .cb-tab', 'Electrodomésticos'); await clickText('.cb-groups .cb-tab', 'Cocción'); await clickText('.cb-subs .cb-tab', 'Hornos'); await sleep(300);
    await (await page.$('.cb-items .mod-btn')).click({ count: 2 }); await sleep(700);
    const horno = (await project()).modules.at(-1);
    check('Horno encastrado en el hueco de la torre', torre.type === 'torre_horno' && horno.type === 'horno' && horno.hostId === torre.id && horno.y > 0, `y=${horno.y}`);
    await shot('09b-encastre');
    await page.keyboard.press('Escape');
    await pickList([torre.id]);
    await page.keyboard.press('Delete'); await sleep(400);
    pm = await project();
    check('Borrar la torre se lleva el horno', !pm.modules.some((m) => m.id === torre.id || m.id === horno.id));
    // Modelos con dos bajos elegidos
    const bajos = pm.modules.filter((m) => m.type.startsWith('bajo') && !m.hidden).slice(0, 2);
    await page.keyboard.press('Escape');
    await pickList(bajos.map((m) => m.id));
    await clickText('.tools-item', '▦Modelos'); await sleep(300);
    check('Modelos arranca en Selección con módulos elegidos', await page.$eval('.models .mv-tabs button.on', (b) => b.textContent).catch(() => '') === 'Selección');
    await page.evaluate(() => [...document.querySelectorAll('.md-row')].find((r) => r.querySelector('.md-label').textContent === 'Tapas:')?.querySelector('.md-value').click()); await sleep(300);
    for (const t of ['Granitos', 'Negro', 'Negro Absoluto']) { const h = await page.evaluateHandle((t) => [...document.querySelectorAll('.cascade .cm-item')].find((b) => b.textContent.trim().replace(/^‹\s*/, '') === t), t); await h.hover(); await h.click(); await sleep(250); }
    pm = await project();
    const withTapa = pm.modules.filter((m) => m.mats?.tapas === 'gra_negro_absoluto').map((m) => m.id).sort();
    check('Modelos · Selección cambia la tapa de los dos bajos elegidos (y de ninguno más)', JSON.stringify(withTapa) === JSON.stringify(bajos.map((m) => m.id).sort()), withTapa.join(','));
    await clickText('.tools-item', '☰Propiedades'); await sleep(200);
    await page.keyboard.press('Escape');
    for (let i = 0; i < 25 && (await project()).modules.length !== n0; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    for (let i = 0; i < 6 && (await project()).modules.some((m) => m.mats?.tapas === 'gra_negro_absoluto'); i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(200); }
    check('Sin errores con el encastre', errors.length === 0, errors.slice(-3).join(' | '));
  }

  // Pestañas
  await clickText('.tabs button', 'Plan de corte'); await sleep(800); await shot('05-corte');
  const nSheets = await page.$$eval('.sheet svg', (s) => s.length);
  const nRows = await page.$$eval('.page table tbody tr', (r) => r.length);
  check('Plan de corte dibuja placas', nSheets > 0, `${nSheets} placas, ${nRows} filas de despiece`);
  await clickText('.tabs button', 'Presupuesto'); await sleep(500); await shot('06-presupuesto');
  const total1 = await page.$eval('.total-pill', (e) => e.textContent);
  check('Presupuesto con total', /\d/.test(total1), total1);
  await clickText('.tabs button', 'Precios'); await sleep(500);
  const [platesTable] = await page.$$('table.edit');
  // Biblioteca de materiales (#71): placas con ruta y piedras con precio por m²
  const libPaths = await page.$$eval('table.edit tbody tr td:first-child input[type=text]', (els) => els.map((e) => e.value));
  check('Precios muestra la biblioteca (Colores, Maderas, Granitos › color › nombre…)', libPaths.includes('Colores > Blanco') && libPaths.includes('Maderas > Roble') && libPaths.includes('Granitos > Gris > Gris Mara') && libPaths.includes('Cuarzo > Blanco Estelar'), libPaths.length + ' materiales');
  const blancoRow = await page.evaluateHandle(() => [...document.querySelectorAll('table.edit tbody tr')].find((r) => [...r.querySelectorAll('input[type=text]')].some((i) => i.value === 'Melamina 18mm Blanco')));
  const priceInputs = await blancoRow.$$('input[type=number], input[inputmode=decimal]');
  await priceInputs.at(-1).click({ count: 3 });
  await priceInputs.at(-1).type('200000');
  await page.keyboard.press('Enter'); await sleep(500);
  const total2 = await page.$eval('.total-pill', (e) => e.textContent);
  check('Cambiar precio actualiza total', total1 !== total2, `${total1} → ${total2}`);
  // Tipos de pieza (#72): la mesada se cobra por m² de su piedra
  await clickText('.tabs button', 'Presupuesto'); await sleep(400);
  const tapaLines = await page.$$eval('.page table tbody tr td:first-child', (els) => els.map((e) => e.textContent.trim()).filter((t) => t.startsWith('Tapa ')));
  check('Presupuesto con la mesada por m² de su piedra', tapaLines.includes('Tapa Granitos > Gris > Gris Mara'), tapaLines.join(' | '));
  await clickText('.tabs button', 'Diseño 3D'); await sleep(600);
  await page.keyboard.press('Escape'); await sleep(200);
  // Herramientas · Modelos (#73): menú en cascada Granitos › Negro › Negro Absoluto (ámbito Todos)
  await clickText('.tools-item', '▦Modelos');
  const mdRow = async (label) => page.evaluateHandle((label) => [...document.querySelectorAll('.md-row')].find((r) => r.querySelector('.md-label').textContent === label + ':')?.querySelector('.md-value'), label);
  const pick = async (...steps) => { for (const t of steps) { const h = await page.evaluateHandle((t) => [...document.querySelectorAll('.cascade .cm-item')].find((b) => b.textContent.trim().replace(/^‹\s*/, '') === t), t); await h.hover(); await h.click(); await sleep(250); } };
  await (await mdRow('Tapas')).click(); await sleep(300);
  await pick('Granitos', 'Negro');
  await shot('06a-modelos-cascada');
  await pick('Negro Absoluto');
  p = await project();
  check('Modelos · Todos: menú en cascada cambia las tapas', p.defaults.tapas === 'gra_negro_absoluto', p.defaults.tapas);
  await clickText('.tabs button', 'Presupuesto'); await sleep(400);
  const tapaLines2 = await page.$$eval('.page table tbody tr td:first-child', (els) => els.map((e) => e.textContent.trim()).filter((t) => t.startsWith('Tapa ')));
  check('Cambiar la piedra de las tapas cambia el presupuesto', p.defaults.tapas === 'gra_negro_absoluto' && tapaLines2.includes('Tapa Granitos > Negro > Negro Absoluto'), tapaLines2.join(' | '));
  await clickText('.tabs button', 'Diseño 3D'); await sleep(400);
  await shot('06b-granito-negro');
  // Selección: solo el módulo elegido; Mostrar todos…
  const selMod = p.modules.find((m) => m.type === 'bajo_mixto');
  const selPt = await page.evaluate((id) => window.__muebles.screenOf(id, 100), selMod.id);
  await page.mouse.click(selPt.x, selPt.y); await sleep(500);
  await clickText('.models .mv-tabs button', 'Selección');
  await (await mdRow('Puertas')).click(); await sleep(300);
  await pick('Colores', 'Negro');
  p = await project();
  check('Modelos · Selección: cambia solo el módulo elegido', p.modules.find((m) => m.id === selMod.id).mats?.puertas === 'mel18_negro' && p.modules.filter((m) => m.mats?.puertas === 'mel18_negro').length === 1 && p.defaults.puertas !== 'mel18_negro');
  await (await mdRow('Frentes')).click(); await sleep(300);
  await clickText('.cascade .cm-item', 'Mostrar todos…');
  await page.type('.showall .qf-search input', 'nogal'); await sleep(200);
  await clickText('.showall .qf-item span', 'Maderas > Nogal');
  await clickText('.showall .qf-foot button', 'Aplicar');
  p = await project();
  check('Mostrar todos… busca y aplica', p.modules.find((m) => m.id === selMod.id).mats?.frentes === 'mel18_nogal' && !(await page.$('.showall')));
  await shot('06c-modelos-seleccion');
  for (let i = 0; i < 2; i++) { await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300); }
  // Accesorios con modelos (#74): tirador barral 320 para todos → 3D y presupuesto
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.tools-item', '▦Modelos');
  const accRows = await page.$$eval('.md-row .md-label', (els) => els.map((e) => e.textContent));
  check('Modelos tiene el grupo Accesorios', ['Tiradores:', 'Bisagras:', 'Correderas:', 'Patas:', 'Acabado:'].every((l) => accRows.includes(l)), accRows.join(' '));
  await (await mdRow('Tiradores')).click(); await sleep(300);
  await pick('Barrales', '320 mm');
  p = await project();
  await clickText('.tabs button', 'Presupuesto'); await sleep(400);
  const herr = await page.$$eval('.page table tbody tr td:first-child', (els) => els.map((e) => e.textContent.trim()));
  check('El tirador elegido va al presupuesto con su precio', p.defaults.tiradores === 'tir_barral_320' && herr.includes('Tirador Barrales > 320 mm') && herr.some((t) => t.startsWith('Bisagra Cazoleta 35 mm')), herr.filter((t) => /^(Tirador|Bisagra|Corredera|Pata)/.test(t)).join(' | '));
  await clickText('.tabs button', 'Diseño 3D'); await sleep(500);
  await shot('06d-tirador-320');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
  // Estilos (#75): aplicar uno de fábrica, guardar uno propio con algunos modelos, renombrar y borrar
  await clickText('.styles-bar button', 'Aplicar estilo');
  await clickText('.style-menu .cm-item', 'Nogal y gris');
  p = await project();
  check('Aplicar estilo cambia los modelos de Todos', p.defaults.puertas === 'mel18_nogal' && p.defaults.tiradores === 'tir_barral_320' && p.defaults.tapas === 'cua_gris_concreto');
  await shot('06e-estilo-nogal');
  await page.click('.styles-bar button[aria-label="Guardar nuevo estilo"]'); await sleep(300);
  await page.type('.style-dialog .sd-name input', 'Mi cocina');
  for (const l of ['Cajas', 'Externo cajas', 'Frentes', 'Fondos', 'Cajones', 'Bisagras', 'Correderas', 'Patas', 'Acabado', 'Tiradores']) {
    await page.evaluate((l) => [...document.querySelectorAll('.style-dialog .sd-check')].find((e) => e.textContent.trim() === l)?.querySelector('input').click(), l);
  }
  await clickText('.style-dialog .qf-foot button', 'Guardar');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.settings')).styles?.find((s) => s.name === 'Mi cocina'));
  check('Guardar nuevo estilo con los modelos tildados', !!saved && JSON.stringify(saved.models) === JSON.stringify({ puertas: 'mel18_nogal', tapas: 'cua_gris_concreto' }), JSON.stringify(saved?.models));
  await page.click('.styles-bar button[aria-label="Editar estilos"]'); await sleep(300);
  const mine = await page.evaluateHandle(() => [...document.querySelectorAll('.style-dialog .sd-row')].find((r) => r.querySelector('input').value === 'Mi cocina'));
  const inp = await mine.$('input'); await inp.click({ count: 3 }); await inp.type('Cocina Pérez');
  await page.evaluate((r) => [...r.querySelectorAll('button')].find((b) => b.textContent === 'Renombrar').click(), mine); await sleep(300);
  let names = await page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.settings')).styles.map((s) => s.name));
  check('Editar estilos: renombrar', names.includes('Cocina Pérez') && !names.includes('Mi cocina'), names.join(', '));
  await page.evaluate(() => [...document.querySelectorAll('.style-dialog .sd-row')].find((r) => r.querySelector('input').value === 'Cocina Pérez').querySelector('button.danger').click()); await sleep(300);
  names = await page.evaluate(() => JSON.parse(localStorage.getItem('mueblesapp.settings')).styles.map((s) => s.name));
  check('Editar estilos: borrar', !names.includes('Cocina Pérez') && names.length === 4, names.join(', '));
  await page.keyboard.press('Escape'); await sleep(200);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(300);
  await page.keyboard.press('KeyE'); await page.keyboard.press('Escape'); await sleep(300);
  await shot('07-precios');

  // Reglas de construcción del proyecto: fondo en ranura cambia el despiece
  await clickText('.tabs button', 'Diseño 3D'); await sleep(800);
  await page.keyboard.press('Escape'); await sleep(200);
  const backSel = await fieldInput('Fondo');
  await backSel.select('ranurado'); await sleep(500);
  p = await project();
  check('Regla de construcción del proyecto se guarda', p.rules?.backType === 'ranurado');
  await clickText('.tabs button', 'Plan de corte'); await sleep(600);
  const lateralDepth = await page.$$eval('.page table tbody tr', (rows) => rows.map((r) => [...r.cells].map((c) => c.textContent)).filter((c) => c[2] === 'Lateral').map((c) => +c[4]));
  check('Fondo en ranura → laterales a profundidad completa', lateralDepth.includes(560), lateralDepth.join(','));
  await clickText('.tabs button', 'Diseño 3D'); await sleep(1500);
  await shot('08-mesada-veta');

  // Ambientes reales
  await page.keyboard.press('Escape'); await sleep(200);
  p = await project();
  check('Ambiente de ejemplo con ventana y puerta', p.room.openings.length === 2 && p.room.points.length === 4);
  await (await fieldInput('Forma')).select('L'); await sleep(500);
  p = await project();
  check('Cambiar a ambiente en L', p.room.points.length === 6, `${p.room.points.length} vértices`);
  await clickText('.room-editor .row-btns button', '+ Ventana'); await sleep(400);
  p = await project();
  check('Agregar ventana', p.room.openings.length === 3);
  await clickText('.room-editor .row-btns button', '+ Columna'); await sleep(400);
  p = await project();
  check('Agregar columna', p.room.columns.length === 1);
  await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
  const nCotas = await page.$$eval('.cota', (e) => e.length);
  check('Planta muestra cotas de paredes y módulos', nCotas >= 6 + p.modules.length, `${nCotas} cotas`);
  await shot('09-planta-L-cotas');
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1200);
  await shot('10-ambiente-L');
  await (await fieldInput('Forma')).select('libre'); await sleep(400);
  const nPts = await page.$$eval('.pts-row', (r) => r.length);
  check('Modo libre muestra los vértices editables', nPts === 6);

  // Proyecto guardado con el formato viejo (v1: polígono + aberturas por índice) se migra solo
  await page.evaluate(() => localStorage.setItem('mueblesapp.project', JSON.stringify({
    name: 'Proyecto viejo',
    room: { shape: 'L', w: 4000, d: 3000, h: 2600, t: 150, cutW: 1200, cutD: 1000, openings: [{ id: 'o1', type: 'ventana', wall: 0, offset: 500, width: 1000, height: 1000, sill: 1000 }], columns: [] },
    defaults: { cuerpo: 'mel18_blanco', frente: 'mel18_roble', fondo: 'fibro3_blanco', cajon: 'mel18_blanco' },
    modules: [],
  })));
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(2000);
  p = await project();
  const wallIds = new Set((p.room.walls || []).map((w) => w.id));
  check('Proyecto v1 se migra a paredes v2', p.room.version === 2 && p.room.walls.length === 6 && p.room.nodes.length === 6, `${p.room.walls?.length} paredes`);
  check('Abertura del proyecto v1 queda en su pared', p.room.openings.length === 1 && wallIds.has(p.room.openings[0].wallId));
  await shot('11-proyecto-v1-migrado');

  // Vista Planta ortográfica con grilla magnética de 50 mm
  await insertFromCatalog('Cajonera interior');
  p = await project();
  const caj = p.modules.at(-1);
  await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
  check('Planta usa cámara ortográfica', (await page.evaluate(() => window.__muebles.cameraType)) === 'OrthographicCamera');
  check('Planta muestra controles de grilla', await page.evaluate(() => !!document.querySelector('.grid-ctl select')));
  const gp = await page.evaluate((id) => window.__muebles.screenOf(id), caj.id);
  await page.mouse.move(gp.x, gp.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(gp.x + 17 * i, gp.y + 13 * i); await sleep(30); }
  await page.mouse.up(); await sleep(500);
  p = await project();
  const cm = p.modules.find((m) => m.id === caj.id);
  check('Arrastre en Planta queda en múltiplos de la grilla (50 mm)', (cm.x !== caj.x || cm.z !== caj.z) && cm.x % 50 === 0 && cm.z % 50 === 0, `(${caj.x},${caj.z}) → (${cm.x},${cm.z})`);
  await shot('12-planta-grilla');
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1200);
  check('Volver a Perspectiva restaura la cámara', (await page.evaluate(() => window.__muebles.cameraType)) === 'PerspectiveCamera');
  await shot('13-vuelta-perspectiva');

  // Seleccionar una pared: panel de propiedades, barra de estado, largo y alto final
  p = await project();
  const w0 = p.room.walls[0];
  const wp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2000), w0.id);
  await page.mouse.click(wp.x, wp.y); await sleep(500);
  check('Clic en pared la selecciona', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Pared 1');
  const sb = await page.$eval('.statusbar .sb-sel', (e) => e.textContent);
  check('Barra de estado describe la pared', sb.startsWith('Pared 1 · 4000 × 150 × 2600'), sb);
  const largo = await fieldInput('Largo');
  await largo.click({ count: 3 }); await largo.type('4500'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  check('Cambiar largo corre la pared siguiente y el ambiente sigue cerrado', p.room.w === 4500 && p.room.points?.length === 6, `w=${p.room.w}`);
  await page.mouse.click(wp.x, wp.y + 400); await sleep(200); // foco fuera del input
  await page.keyboard.press('Escape'); await sleep(200);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer el cambio de largo', p.room.w === 4000, `w=${p.room.w}`);
  await page.mouse.click(wp.x, wp.y); await sleep(500);
  const altoFinal = await fieldInput('Alto final');
  await altoFinal.click({ count: 3 }); await altoFinal.type('2000'); await page.keyboard.press('Enter'); await sleep(600);
  p = await project();
  check('Alto final distinto deja la pared inclinada', p.room.walls[0].h0 === 2600 && p.room.walls[0].h1 === 2000);
  await shot('14-pared-seleccionada-inclinada');
  check('Sin errores de consola tras editar paredes', errors.length === 0, errors.slice(-3).join(' | '));

  // Arrastrar paredes y vértices en Planta (grilla magnética de 50 mm)
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.vp-toolbar button', 'Planta'); await sleep(1200);
  p = await project();
  const dragFrom = async (pt, dx, dy) => {
    await page.mouse.move(pt.x, pt.y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) { await page.mouse.move(pt.x + (dx * i) / 8, pt.y + (dy * i) / 8); await sleep(30); }
    await page.mouse.up(); await sleep(500);
  };
  await insertFromCatalog('Bajo mesada puertas'); await page.keyboard.press('Escape'); await sleep(300); // uno apoyado en el fondo
  p = await project();
  const onBack = p.modules.filter((m) => m.z === 0 && !m.rot).map((m) => m.id); // apoyados en la pared del fondo
  const bp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2000, 75), p.room.walls[0].id);
  await dragFrom(bp, 0, -50);
  p = await project();
  const zBack = p.room.points[0][1];
  check('Los módulos apoyados acompañan a la pared que se mueve', onBack.length > 0 && onBack.every((id) => p.modules.find((m) => m.id === id).z === zBack), `${onBack.length} módulos → z=${onBack.map((id) => p.modules.find((m) => m.id === id).z)}`);
  check('Arrastrar la pared del fondo la corre en paralelo y estira las vecinas', zBack < 0 && zBack % 50 === 0 && p.room.points[1][1] === zBack && p.room.points.length === 6, `z=${zBack}`);
  await shot('15-planta-pared-arrastrada');
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer el arrastre de pared en un paso', p.room.points[0][1] === 0, `z=${p.room.points[0][1]}`);
  check('Deshacer también devuelve los módulos', onBack.every((id) => p.modules.find((m) => m.id === id).z === 0));
  await ctrl('KeyZ'); p = await project(); // saca el bajo de prueba
  const corner = p.room.nodes[1];
  const cp = await page.evaluate((id) => window.__muebles.screenOfNode(id), corner.id);
  await dragFrom(cp, 40, 0);
  p = await project();
  const c2 = p.room.nodes.find((n) => n.id === corner.id);
  check('Arrastrar un vértice mueve la esquina', c2.x > corner.x && c2.x % 50 === 0 && c2.z === corner.z, `(${corner.x},${corner.z}) → (${c2.x},${c2.z})`);
  await shot('16-planta-vertice-arrastrado');
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1200);
  p = await project();
  const nodesBefore = JSON.stringify(p.room.nodes);
  const pp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 1500), p.room.walls[0].id);
  await dragFrom(pp, 0, 60);
  p = await project();
  check('En 3D una pared no movible se selecciona pero no se arrastra', JSON.stringify(p.room.nodes) === nodesBefore && (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Pared 1');
  check('Sin errores de consola tras arrastrar paredes', errors.length === 0, errors.slice(-3).join(' | '));

  // Cotas de referencia del módulo seleccionado (distancia a paredes / vecinos), editables
  await page.keyboard.press('Escape'); await sleep(200);
  p = await project();
  const cj = p.modules.find((m) => m.type === 'cajonera_placard');
  const cjp = await page.evaluate((id) => window.__muebles.screenOf(id), cj.id);
  await page.mouse.click(cjp.x, cjp.y); await sleep(600);
  const dists = await page.$$eval('.cota-dist', (els) => els.map((e) => e.textContent));
  check('Al seleccionar un módulo aparecen sus cotas a paredes', dists.includes(String(cj.x)) && dists.includes(String(cj.z)), dists.join(', '));
  await shot('17-cotas-modulo');
  const clickCota = async (sel, text) => {
    const ok = await page.evaluate((sel, text) => { const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === text); if (el) el.click(); return !!el; }, sel, text);
    if (!ok) throw new Error(`No encontré la cota "${text}"`);
    await sleep(300);
  };
  await clickCota('.cota-dist', String(cj.x));
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.type('1500'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  check('Editar la cota a la pared mueve el módulo', p.modules.find((m) => m.id === cj.id).x === 1500, `x=${p.modules.find((m) => m.id === cj.id).x}`);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer la edición de cota', p.modules.find((m) => m.id === cj.id).x === cj.x);
  const p1 = (await page.$$eval('.cota.editable', (els) => els.map((e) => e.textContent))).find((t) => t.startsWith('P1 ·'));
  await clickCota('.cota.editable', p1);
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.type('4500'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  const pr = p.room.nodes;
  check('Editar la cota de una pared cambia su largo', Math.round(Math.hypot(pr[1].x - pr[0].x, pr[1].z - pr[0].z)) === 4500, p1);
  // Cotas verticales: piso y techo (#40)
  await page.keyboard.press('Escape'); await sleep(200);
  p = await project();
  const vj = p.modules.find((m) => m.type === 'cajonera_placard');
  const vjp = await page.evaluate((id) => window.__muebles.screenOf(id), vj.id);
  await page.mouse.click(vjp.x, vjp.y); await sleep(600);
  const alt = await fieldInput('Altura desde el piso');
  await alt.click({ count: 3 }); await alt.type('80'); await page.keyboard.press('Enter'); await sleep(600);
  const vText = (cls) => page.$$eval(cls, (els) => els.map((e) => e.textContent.trim()));
  const down = await vText('.cota-down'), up = await vText('.cota-up');
  check('Módulo a 80 mm del piso muestra la cota al piso y al techo', down[0] === '80' && up.length === 1, `abajo ${down}, arriba ${up}`);
  await shot('17b-cota-piso');
  await clickCota('.cota-down', '80');
  await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
  await page.keyboard.type('100'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  check('Editar la cota al piso sube el módulo', p.modules.find((m) => m.id === vj.id).y === 100, `y=${p.modules.find((m) => m.id === vj.id).y}`);
  await ctrl('KeyZ'); await ctrl('KeyZ');
  p = await project();
  check('Deshacer deja el módulo en el piso', (p.modules.find((m) => m.id === vj.id).y || 0) === (vj.y || 0));
  check('Sin errores de consola tras editar cotas', errors.length === 0, errors.slice(-3).join(' | '));

  // Flechas para estirar / achicar el módulo seleccionado (#29)
  await page.keyboard.press('Escape'); await sleep(200);
  p = await project();
  let cz = p.modules.find((m) => m.type === 'cajonera_placard');
  const czp = await page.evaluate((id) => window.__muebles.screenOf(id), cz.id);
  await page.mouse.click(czp.x, czp.y); await sleep(600);
  const hR = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'right'), cz.id);
  const hL = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'left'), cz.id);
  const len = Math.hypot(hR.x - hL.x, hR.y - hL.y);
  const ux = (hR.x - hL.x) / len, uy = (hR.y - hL.y) / len;
  await dragFrom(hR, ux * 60, uy * 60);
  p = await project();
  let c1 = p.modules.find((m) => m.id === cz.id);
  check('Flecha derecha estira el ancho y deja fijo el lado izquierdo', c1.params.width > cz.params.width && c1.params.width % 10 === 0 && c1.x === cz.x, `${cz.params.width} → ${c1.params.width}, x=${c1.x}`);
  await shot('18-flecha-derecha');
  const right = c1.x + c1.params.width;
  const hL2 = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'left'), cz.id);
  await dragFrom(hL2, -ux * 50, -uy * 50);
  p = await project();
  const c2b = p.modules.find((m) => m.id === cz.id);
  check('Flecha izquierda estira y deja fijo el lado derecho', c2b.params.width > c1.params.width && c2b.x + c2b.params.width === right, `x=${c2b.x}, ancho=${c2b.params.width}`);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer un estiramiento en un paso', p.modules.find((m) => m.id === cz.id).params.width === c1.params.width);
  const hT = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'top'), cz.id);
  await dragFrom(hT, 0, -40);
  p = await project();
  check('Flecha de arriba cambia el alto', p.modules.find((m) => m.id === cz.id).params.height > cz.params.height, `alto=${p.modules.find((m) => m.id === cz.id).params.height}`);
  // Flechas a ambos lados, por eje (#43): la de atrás estira hacia atrás y deja fijo el frente
  p = await project();
  const c3 = p.modules.find((m) => m.id === cz.id);
  const hF = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'front'), cz.id);
  const hB = await page.evaluate((id) => window.__muebles.screenOfHandle(id, 'back'), cz.id);
  const lb = Math.hypot(hB.x - hF.x, hB.y - hF.y);
  await dragFrom(hB, ((hB.x - hF.x) / lb) * 40, ((hB.y - hF.y) / lb) * 40);
  p = await project();
  const c4 = p.modules.find((m) => m.id === cz.id);
  check('Flecha de atrás estira la profundidad y deja fijo el frente', c4.params.depth > c3.params.depth && c4.z + c4.params.depth === c3.z + c3.params.depth, `prof ${c3.params.depth} → ${c4.params.depth}, z=${c4.z}`);
  await shot('18b-flechas-eje');
  check('Sin errores de consola tras redimensionar', errors.length === 0, errors.slice(-3).join(' | '));

  // Construir paredes (#6): proyecto nuevo con 2 paredes y un rectángulo dibujado solo con teclado
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.top-actions button', 'Nuevo'); await sleep(1500);
  p = await project();
  check('Proyecto nuevo arranca con 2 paredes y piso', p.room.walls.length === 2 && p.room.points === null, `${p.room.walls.length} paredes`);
  await clickText('.vp-toolbar button', '✏ Paredes'); await sleep(1500);
  check('Construir paredes pasa a Planta y muestra la barra', (await page.evaluate(() => window.__muebles.cameraType)) === 'OrthographicCamera' && !!(await page.$('.draw-hud')));
  const sp = await page.evaluate(() => window.__muebles.screenOfPoint(1000, 1000));
  await page.mouse.click(sp.x, sp.y); await sleep(400);
  const seg = async (len, ang) => { await page.keyboard.type(len); await page.keyboard.press('Enter'); await page.keyboard.type(ang); await page.keyboard.press('Enter'); await sleep(500); };
  await seg('2000', '0'); await seg('1500', '90'); await seg('2000', '90'); await seg('1500', '90');
  p = await project();
  check('Rectángulo dibujado solo con teclado se cierra (piso automático)', p.room.walls.length === 6 && p.room.points?.length === 4, `${p.room.walls.length} paredes, contorno ${JSON.stringify(p.room.points)}`);
  check('Al cerrar el ambiente termina la herramienta', !(await page.$('.draw-hud')));
  await shot('19-paredes-dibujadas');
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer quita solo el último tramo', p.room.walls.length === 5, `${p.room.walls.length} paredes`);
  check('Sin errores de consola tras construir paredes', errors.length === 0, errors.slice(-3).join(' | '));

  // Eliminar y dividir paredes (#7): menú de clic derecho, Supr y diálogo con módulos apoyados
  await page.keyboard.press('Escape'); await sleep(200);
  await (await fieldInput('Plantilla')).select('rect'); await sleep(200);
  await clickText('.room-editor button', 'Aplicar plantilla'); await sleep(800);
  p = await project();
  check('Aplicar plantilla rectangular', p.room.walls.length === 4 && p.room.points?.length === 4, `${p.room.walls.length} paredes`);
  await insertFromCatalog('Bajo mesada puertas'); await sleep(400);
  await page.keyboard.press('Escape'); await sleep(200);
  p = await project();
  const backWall = p.room.walls[0];
  const bw = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2000, 75), backWall.id);
  await page.mouse.click(bw.x, bw.y, { button: 'right' }); await sleep(500);
  check('Clic derecho en una pared abre su menú', !!(await page.$('.wall-menu')));
  await clickText('.wall-menu button', 'Dividir aquí'); await sleep(600);
  p = await project();
  check('Dividir aquí agrega un vértice y un tramo', p.room.walls.length === 5 && p.room.points?.length === 5, `${p.room.walls.length} paredes`);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer la división', p.room.walls.length === 4);
  await page.mouse.click(bw.x, bw.y); await sleep(500);
  await page.keyboard.press('Delete'); await sleep(500);
  check('Supr sobre una pared abre el diálogo de eliminar', !!(await page.$('.wall-dialog')));
  await page.click('.wall-dialog input[type=checkbox]'); await sleep(100);
  await clickText('.wall-dialog button', 'Eliminar'); await sleep(700);
  p = await project();
  check('Eliminar la pared del fondo y el módulo apoyado en ella', p.room.walls.length === 3 && p.room.points === null && p.modules.length === 0, `${p.room.walls.length} paredes, ${p.modules.length} módulos`);
  await shot('20-pared-eliminada');
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer la eliminación en un paso', p.room.walls.length === 4 && p.modules.length === 1);
  check('Sin errores de consola tras eliminar paredes', errors.length === 0, errors.slice(-3).join(' | '));

  // Cotas angulares automáticas (#8): 90° en las 4 esquinas del rectángulo, editables
  await page.keyboard.press('Escape'); await sleep(300);
  const angs = await page.$$eval('.cota-ang', (els) => els.map((e) => e.textContent));
  check('Rectángulo muestra 90° en sus 4 esquinas', angs.length === 4 && angs.every((t) => t === '90°'), angs.join(', '));
  await shot('21-cotas-angulares');
  await clickCota('.cota-ang', '90°');
  await page.keyboard.type('100'); await page.keyboard.press('Enter'); await sleep(600);
  const angs2 = await page.$$eval('.cota-ang', (els) => els.map((e) => e.textContent));
  check('Editar una cota angular gira la pared', angs2.includes('100°'), angs2.join(', '));
  await ctrl('KeyZ');
  const angs3 = await page.$$eval('.cota-ang', (els) => els.map((e) => e.textContent));
  check('Deshacer la edición de ángulo', angs3.length === 4 && angs3.every((t) => t === '90°'), angs3.join(', '));

  // Aberturas y columnas arrastrables (#10)
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.room-editor .row-btns button', '+ Ventana'); await sleep(400);
  p = await project();
  const win = p.room.openings.at(-1);
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1500);
  const wp1 = await page.evaluate((id) => window.__muebles.screenOfOpening(id), win.id);
  await dragFrom(wp1, 60, 0);
  p = await project();
  const win2 = p.room.openings.find((o) => o.id === win.id);
  check('Clic en una ventana la selecciona', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Ventana' && (await page.$eval('.statusbar .sb-sel', (e) => e.textContent)).startsWith('Ventana · 1200 × 1100'));
  check('Arrastrar la ventana la corre a lo largo de su pared', win2.wallId === win.wallId && win2.offset !== win.offset && win2.offset % 10 === 0, `${win.offset} → ${win2.offset}`);
  const ods = await page.$$eval('.cota-dist', (els) => els.map((e) => e.textContent));
  check('La ventana muestra sus cotas a los extremos de la pared', ods.includes(String(win2.offset)), ods.join(', '));
  await clickCota('.cota-dist', String(win2.offset));
  await page.keyboard.type('500'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  check('Editar la cota de la ventana la ubica', p.room.openings.find((o) => o.id === win.id).offset === 500);
  await shot('22-ventana-seleccionada');
  await page.mouse.click(5, 450); await sleep(100); // foco fuera de inputs
  const wp2 = await page.evaluate((id) => window.__muebles.screenOfOpening(id), win.id);
  await page.mouse.click(wp2.x, wp2.y); await sleep(300);
  await page.keyboard.press('Delete'); await sleep(400);
  p = await project();
  check('Supr quita la ventana seleccionada', !p.room.openings.some((o) => o.id === win.id));
  await ctrl('KeyZ');
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.room-editor .row-btns button', '+ Columna'); await sleep(400);
  p = await project();
  const col = p.room.columns.at(-1);
  await clickText('.vp-toolbar button', 'Planta'); await sleep(1500);
  const cpt = await page.evaluate(() => window.__muebles.screenOfPoint(150, 150, 2600));
  await dragFrom(cpt, 150, 130);
  p = await project();
  const col2 = p.room.columns.find((c) => c.id === col.id);
  check('Arrastrar una columna en Planta (grilla de 50)', (col2.x !== col.x || col2.z !== col.z) && col2.x % 50 === 0 && col2.z % 50 === 0 && (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Columna', `(${col.x},${col.z}) → (${col2.x},${col2.z})`);
  check('Sin errores de consola tras aberturas y columnas', errors.length === 0, errors.slice(-3).join(' | '));

  // Rebajar / Transparente / Auto Rebajar (#11)
  await page.keyboard.press('Escape'); await sleep(200);
  await ctrl('KeyZ'); await ctrl('KeyZ'); // saca la columna de prueba (arrastre + alta)
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1500);
  p = await project();
  const [backW, , frontW] = p.room.walls;
  let low = await page.evaluate(() => window.__mueblesLowered || {});
  check('Auto rebajar baja a zócalo la pared que tapa la vista', low[frontW.id] === true && low[backW.id] === false, JSON.stringify(low));
  await clickText('.statusbar .sb-toggle', 'Auto Rebajar'); await sleep(700);
  low = await page.evaluate(() => window.__mueblesLowered || {});
  check('Sin Auto rebajar la pared de adelante vuelve a subir', low[frontW.id] === false);
  await shot('23-sin-auto-rebajar');
  await clickText('.statusbar .sb-toggle', 'Auto Rebajar'); await sleep(700);
  const bp3 = await page.evaluate((id) => window.__muebles.screenOfWall(id, 1500), backW.id);
  await page.mouse.click(bp3.x, bp3.y, { button: 'right' }); await sleep(400);
  await clickText('.wall-menu button', 'Transparente'); await sleep(400);
  p = await project();
  check('Pared transparente desde el menú', p.room.walls[0].transparent === true);
  await page.mouse.click(bp3.x, bp3.y, { button: 'right' }); await sleep(400);
  await clickText('.wall-menu button', 'Opaca'); await sleep(300);
  await page.mouse.click(bp3.x, bp3.y, { button: 'right' }); await sleep(400);
  await clickText('.wall-menu button', 'Rebajar'); await sleep(500);
  p = await project();
  check('Rebajar a mano desde el menú', p.room.walls[0].lowered === true && p.room.walls[0].transparent === false);
  await shot('24-pared-rebajada');
  const plinth = await page.evaluate((id) => window.__muebles.screenOfWall(id, 50), backW.id);
  await page.mouse.click(plinth.x, plinth.y); await sleep(500);
  p = await project();
  check('Clic en el zócalo de una pared rebajada la restaura', p.room.walls[0].lowered === false);
  check('Sin errores de consola tras rebajar paredes', errors.length === 0, errors.slice(-3).join(' | '));

  // Regla de alturas en vista Frente (#12)
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.vp-toolbar button', 'Frente'); await sleep(1500);
  const ruler = await page.$$eval('.cota-ruler', (els) => els.map((e) => e.textContent));
  check('Frente muestra la regla de alturas (referencias + módulos)', ['100', '820', '1470', '2010', '2280', '870'].every((h) => ruler.includes(h)), ruler.join(', '));
  await shot('25-regla-alturas');
  const rh = await fieldInput('Regla de alturas (Frente)');
  await rh.click({ count: 3 }); await rh.type('100, 900, 2100'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  const ruler2 = await page.$$eval('.cota-ruler', (els) => els.map((e) => e.textContent));
  check('Editar la lista de alturas se guarda en el proyecto', JSON.stringify(p.room.refHeights) === '[100,900,2100]' && ruler2.includes('900') && !ruler2.includes('1470'), ruler2.join(', '));
  await ctrl('KeyZ');

  // Cotas manuales lineales y angulares (#13)
  await page.keyboard.press('Escape'); await sleep(200);
  await clickText('.vp-toolbar button', '↔ Cota'); await sleep(1500);
  const at = (x, z) => page.evaluate((x, z) => window.__muebles.screenOfPoint(x, z), x, z);
  let q = await at(605, 555); await page.mouse.click(q.x, q.y); await sleep(300); // esquina del bajo (imán a vértice)
  q = await at(3590, 560); await page.mouse.click(q.x, q.y); await sleep(500);   // pared derecha (imán a la arista)
  p = await project();
  let man = await page.$$eval('.cota-man', (els) => els.map((e) => e.textContent));
  check('Cota lineal entre la esquina del módulo y la pared', p.annotations?.length === 1 && man.includes('3000'), man.join(', '));
  await page.evaluate(() => [...document.querySelectorAll('.draw-hud label')].find((l) => l.textContent.includes('Angular')).querySelector('input').click()); await sleep(200);
  for (const [x, z] of [[0, 2990], [5, 5], [3590, 0]]) { q = await at(x, z); await page.mouse.click(q.x, q.y); await sleep(300); }
  await sleep(300);
  p = await project();
  man = await page.$$eval('.cota-man', (els) => els.map((e) => e.textContent));
  check('Cota angular entre dos paredes muestra 90°', p.annotations?.length === 2 && man.includes('90°'), man.join(', '));
  await shot('26-cotas-manuales');
  await page.keyboard.press('Escape'); await sleep(300);
  check('Esc termina la herramienta de cotas', !(await page.$('.draw-hud')));
  await clickCota('.cota-man', '3000');
  check('Clic en una cota manual la selecciona', (await page.$eval('.statusbar .sb-sel', (e) => e.textContent)) === 'Cota lineal · 3000 mm');
  await page.keyboard.press('Delete'); await sleep(400);
  p = await project();
  check('Supr borra la cota manual', p.annotations.length === 1);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer el borrado de la cota', p.annotations.length === 2);
  check('Sin errores de consola tras cotas manuales', errors.length === 0, errors.slice(-3).join(' | '));

  // Plano de referencia como imagen, escalado con 2 puntos (#14)
  await page.keyboard.press('Escape'); await sleep(200);
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 100;
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 200, 100); g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(10, 10, 180, 80);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'plano.png', { type: 'image/png' }));
    const input = document.querySelector('.room-editor input[type=file]');
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(1200);
  p = await project();
  check('Cargar plano de referencia (ocupa el ancho del ambiente)', p.planImage?.wPx === 200 && Math.abs(p.planImage.mmPerPx - 18) < 0.01, JSON.stringify({ ...p.planImage, src: undefined }));
  check('El plano se ve en Planta', await page.evaluate(() => window.__muebles.planImageShown));
  await clickText('.room-editor button', 'Escalar con 2 puntos'); await sleep(1200);
  let sq = await page.evaluate(() => window.__muebles.screenOfPoint(0, 1500)); await page.mouse.click(sq.x, sq.y); await sleep(300);
  sq = await page.evaluate(() => window.__muebles.screenOfPoint(1800, 1500)); await page.mouse.click(sq.x, sq.y); await sleep(400);
  await page.keyboard.type('3000'); await page.keyboard.press('Enter'); await sleep(600);
  p = await project();
  check('Escalar con 2 puntos: el tramo marcado pasa a medir 3000', Math.abs(p.planImage.mmPerPx - 30) < 0.5 && Math.abs(p.planImage.x) < 20, `mm/px=${p.planImage.mmPerPx.toFixed(2)}, x=${Math.round(p.planImage.x)}`);
  await shot('27-plano-referencia');
  await clickText('.vp-toolbar button', 'Perspectiva'); await sleep(1200);
  check('El plano de referencia no aparece fuera de Planta', !(await page.evaluate(() => window.__muebles.planImageShown)));
  check('Sin errores de consola tras plano de referencia', errors.length === 0, errors.slice(-3).join(' | '));
  check('Sin errores de consola al final', errors.length === 0, errors.slice(-3).join(' | '));
} catch (e) {
  check('Ejecución del escenario', false, e.message + (errors.length ? ' | consola: ' + errors.slice(-3).join(' | ').slice(0, 800) : ''));
  await shot('99-error').catch(() => {});
} finally {
  await browser.close();
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - fail}/${results.length} OK · capturas en ${OUT}`);
  process.exitCode = fail ? 1 : 0;
}
