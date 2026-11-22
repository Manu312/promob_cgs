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
