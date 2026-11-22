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
  await clickText('.mod-btn span', 'Placard batientes');
  p = await project();
  check('Agregar módulo desde catálogo', p.modules.length === 8);
  const placard = p.modules.at(-1);
  check('Módulo nuevo queda seleccionado', (await page.$eval('.inspector h3', (e) => e.textContent)) === 'Placard batientes');

  // Editar medida en inspector
  const w = await fieldInput('Ancho');
  await w.click({ clickCount: 3 });
  await w.type('1500');
  await page.keyboard.press('Enter');
  await sleep(400);
  p = await project();
  check('Editar ancho desde inspector', p.modules.find((m) => m.id === placard.id).params.width === 1500);

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
  await clickText('.row-btns button', 'Duplicar');
  p = await project();
  check('Duplicar módulo', p.modules.length === 9);
  await page.keyboard.press('Delete'); await sleep(300);
  p = await project();
  check('Supr borra módulo', p.modules.length === 8);

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

  // Render final fotorrealista (trazado de rayos)
  await clickText('.vp-toolbar button', 'Render final');
  let sm = 0;
  for (let i = 0; i < 40 && sm < 20; i++) { await sleep(1500); sm = await page.$eval('.pt-progress', (e) => parseInt(e.textContent.match(/(\d+)\//)?.[1] || '0', 10)).catch(() => 0); }
  await shot('04b-render-final');
  check('Render final acumula muestras', sm > 0, `${sm} muestras`);
  check('Sin errores en render final', errors.length === 0, errors.slice(-3).join(' | '));
  await clickText('.vp-toolbar button', '■ Detener'); await sleep(500);

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
  const priceInputs = await platesTable.$$('tbody tr:first-child input[type=number]');
  await priceInputs.at(-1).click({ clickCount: 3 });
  await priceInputs.at(-1).type('200000');
  await page.keyboard.press('Enter'); await sleep(500);
  const total2 = await page.$eval('.total-pill', (e) => e.textContent);
  check('Cambiar precio actualiza total', total1 !== total2, `${total1} → ${total2}`);
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
  await clickText('.mod-btn span', 'Cajonera interior');
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
  await largo.click({ clickCount: 3 }); await largo.type('4500'); await page.keyboard.press('Enter'); await sleep(500);
  p = await project();
  check('Cambiar largo corre la pared siguiente y el ambiente sigue cerrado', p.room.w === 4500 && p.room.points?.length === 6, `w=${p.room.w}`);
  await page.mouse.click(wp.x, wp.y + 400); await sleep(200); // foco fuera del input
  await page.keyboard.press('Escape'); await sleep(200);
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer el cambio de largo', p.room.w === 4000, `w=${p.room.w}`);
  await page.mouse.click(wp.x, wp.y); await sleep(500);
  const altoFinal = await fieldInput('Alto final');
  await altoFinal.click({ clickCount: 3 }); await altoFinal.type('2000'); await page.keyboard.press('Enter'); await sleep(600);
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
  const bp = await page.evaluate((id) => window.__muebles.screenOfWall(id, 2000, 75), p.room.walls[0].id);
  await dragFrom(bp, 0, -50);
  p = await project();
  const zBack = p.room.points[0][1];
  check('Arrastrar la pared del fondo la corre en paralelo y estira las vecinas', zBack < 0 && zBack % 50 === 0 && p.room.points[1][1] === zBack && p.room.points.length === 6, `z=${zBack}`);
  await shot('15-planta-pared-arrastrada');
  await ctrl('KeyZ');
  p = await project();
  check('Deshacer el arrastre de pared en un paso', p.room.points[0][1] === 0, `z=${p.room.points[0][1]}`);
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
  await clickText('.mod-btn span', 'Bajo mesada puertas'); await sleep(400);
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
  await clickText('.vp-toolbar button', 'Auto rebajar'); await sleep(700);
  low = await page.evaluate(() => window.__mueblesLowered || {});
  check('Sin Auto rebajar la pared de adelante vuelve a subir', low[frontW.id] === false);
  await shot('23-sin-auto-rebajar');
  await clickText('.vp-toolbar button', 'Auto rebajar'); await sleep(700);
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
  await rh.click({ clickCount: 3 }); await rh.type('100, 900, 2100'); await page.keyboard.press('Enter'); await sleep(500);
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
