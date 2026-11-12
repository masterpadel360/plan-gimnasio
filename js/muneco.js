// Muñeco animado reutilizable. Cada ejercicio es una lista de posiciones clave (plan.json → ejercicio.anim).
// Coordenadas en "cm de muñeco": x hacia adelante (o hacia la derecha en vista de frente), y hacia arriba, piso en y = 0.
// Ángulos en grados. Ver README.md → «El muñeco».

const L = { tronco: 50, cuello: 6, cabeza: 9, brazo: 28, antebrazo: 26, muslo: 44, pierna: 42, pie: 13 };
const ANCHO = { hombro: 15, cadera: 9 }; // solo en vista de frente
const rad = (d) => (d * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function mezclar(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) return a.map((v, i) => mezclar(v, b[i] ?? v, t));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const o = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = k in a && k in b ? mezclar(a[k], b[k], t) : (k in b ? b[k] : a[k]);
    return o;
  }
  return t < 0.5 ? a : b;
}

// Dos huesos: desde la raíz hasta el objetivo. dir: 1 = la articulación del medio sale hacia +x (rodilla adelante),
// -1 = hacia -x (codo atrás), 'arriba' / 'abajo' = hacia +y / -y (útil con el cuerpo acostado).
function ik(raiz, obj, l1, l2, dir) {
  const dx = obj[0] - raiz[0], dy = obj[1] - raiz[1];
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const b = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const c1 = [raiz[0] + l1 * Math.cos(a + b), raiz[1] + l1 * Math.sin(a + b)];
  const c2 = [raiz[0] + l1 * Math.cos(a - b), raiz[1] + l1 * Math.sin(a - b)];
  if (dir === 'arriba') return c1[1] >= c2[1] ? c1 : c2;
  if (dir === 'abajo') return c1[1] <= c2[1] ? c1 : c2;
  return (dir >= 0 ? c1[0] >= c2[0] : c1[0] <= c2[0]) ? c1 : c2;
}
const desde = (p, ang, l) => [p[0] + l * Math.sin(rad(ang)), p[1] - l * Math.cos(rad(ang))]; // ang desde "abajo", + hacia +x

// Calcula todas las articulaciones de una pose.
export function esqueleto(pose, vista) {
  const pelvis = pose.pelvis || [0, 88];
  const tronco = pose.tronco || 0;
  const cuello = [pelvis[0] + L.tronco * Math.sin(rad(tronco)), pelvis[1] + L.tronco * Math.cos(rad(tronco))];
  const cab = tronco + (pose.cabeza || 0);
  const cabeza = [cuello[0] + (L.cuello + L.cabeza) * Math.sin(rad(cab)), cuello[1] + (L.cuello + L.cabeza) * Math.cos(rad(cab))];
  const frente = vista === 'frente';
  const off = (p, dx) => [p[0] + dx, p[1]];
  const J = { pelvis, cuello, cabeza };
  for (const lado of ['I', 'D']) {
    const sg = lado === 'I' ? -1 : 1;
    const hombro = frente ? off(cuello, sg * ANCHO.hombro) : cuello.slice();
    const cadera = frente ? off(pelvis, sg * ANCHO.cadera) : pelvis.slice();
    // Brazo: por ángulos [hombro, codo] (desde abajo, + hacia +x) o por mano [x,y] con codo ±1
    let codo, mano;
    const b = pose['brazo' + lado];
    if (pose['mano' + lado]) {
      mano = pose['mano' + lado];
      codo = ik(hombro, mano, L.brazo, L.antebrazo, pose['codo' + lado] ?? -1);
    } else {
      const ang = b ? b : [0, 0];
      codo = desde(hombro, ang[0], L.brazo);
      mano = desde(codo, ang[1], L.antebrazo);
    }
    // Pierna: por pie [x,y] (IK) con rodilla ±1
    const pie = pose['pie' + lado] || [cadera[0] + (frente ? sg * 3 : 0), 0];
    const rodilla = ik(cadera, pie, L.muslo, L.pierna, pose['rodilla' + lado] ?? 1);
    const pa = pose['pieAng' + lado] ?? 0; // 0 = apoyado plano hacia adelante
    const punta = frente ? [pie[0] + sg * 4, pie[1]] : [pie[0] + L.pie * Math.cos(rad(pa)), pie[1] + L.pie * Math.sin(rad(pa))];
    Object.assign(J, { ['hombro' + lado]: hombro, ['codo' + lado]: codo, ['mano' + lado]: mano, ['cadera' + lado]: cadera, ['rodilla' + lado]: rodilla, ['pie' + lado]: pie, ['punta' + lado]: punta });
  }
  J.manos = [(J.manoI[0] + J.manoD[0]) / 2, (J.manoI[1] + J.manoD[1]) / 2];
  return J;
}

const SEG = {
  tronco: ['pelvis', 'cuello'],
  brazoI: ['hombroI', 'codoI'], antebrazoI: ['codoI', 'manoI'], brazoD: ['hombroD', 'codoD'], antebrazoD: ['codoD', 'manoD'],
  musloI: ['caderaI', 'rodillaI'], piernaI: ['rodillaI', 'pieI'], pieI: ['pieI', 'puntaI'],
  musloD: ['caderaD', 'rodillaD'], piernaD: ['rodillaD', 'pieD'], pieD: ['pieD', 'puntaD'],
};

// --- Dibujo SVG ---
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const P = (p) => [p[0], -p[1]]; // y hacia arriba → SVG

function linea(g, a, b, cls, w) { const [x1, y1] = P(a), [x2, y2] = P(b); g.appendChild(el('line', { x1, y1, x2, y2, class: cls, 'stroke-width': w })); }

function dibujarEquipo(g, eq, J, vista, delante) {
  for (const e of eq || []) {
    const adelante = e.delante ?? ['mancuerna', 'barra'].includes(e.tipo);
    if (adelante !== delante) continue;
    if (e.tipo === 'banco' || e.tipo === 'cajon' || e.tipo === 'maquina') {
      const h = e.alto ?? 42, w = e.ancho ?? 40, x = e.x ?? -60;
      g.appendChild(el('rect', { x: x - w / 2, y: -h, width: w, height: h - (e.tipo === 'banco' ? 0 : 0), rx: 3, class: 'eq eq-' + e.tipo }));
      if (e.tipo === 'banco') { g.appendChild(el('line', { x1: x - w / 2 + 6, y1: -h + 6, x2: x - w / 2 + 6, y2: 0, class: 'eq-pata' })); g.appendChild(el('line', { x1: x + w / 2 - 6, y1: -h + 6, x2: x + w / 2 - 6, y2: 0, class: 'eq-pata' })); }
    }
    if (e.tipo === 'mancuerna') {
      for (const m of e.manos || ['manoI', 'manoD']) {
        const [x, y] = P(J[m]);
        if (vista === 'frente') { g.appendChild(el('rect', { x: x - 3, y: y - 9, width: 6, height: 18, rx: 2, class: 'eq-peso' })); }
        else { g.appendChild(el('rect', { x: x - 10, y: y - 3, width: 20, height: 6, rx: 2, class: 'eq-barra' })); g.appendChild(el('rect', { x: x - 11, y: y - 6, width: 6, height: 12, rx: 2, class: 'eq-peso' })); g.appendChild(el('rect', { x: x + 5, y: y - 6, width: 6, height: 12, rx: 2, class: 'eq-peso' })); }
      }
    }
    if (e.tipo === 'barra') {
      const [x, y] = P(J.manos);
      if (vista === 'frente') { g.appendChild(el('line', { x1: x - 70, y1: y, x2: x + 70, y2: y, class: 'eq-barra-l' })); for (const s of [-1, 1]) g.appendChild(el('rect', { x: x + s * 62 - 4, y: y - 18, width: 8, height: 36, rx: 2, class: 'eq-peso' })); }
      else { g.appendChild(el('circle', { cx: x, cy: y, r: 17, class: 'eq-disco' })); g.appendChild(el('circle', { cx: x, cy: y, r: 3, class: 'eq-centro' })); }
    }
    if (e.tipo === 'polea') {
      const top = [e.x ?? 70, e.alto ?? 190];
      g.appendChild(el('rect', { x: top[0] - 4, y: -top[1], width: 8, height: top[1], class: 'eq eq-maquina' }));
      const [hx, hy] = P(J[e.mano || 'manos']); const [px, py] = P(e.desde ? e.desde : top);
      g.appendChild(el('line', { x1: px, y1: py, x2: hx, y2: hy, class: 'eq-cable' }));
    }
  }
}

function dibujarGuias(g, guias, J) {
  for (const gu of guias || []) {
    const at = (n) => (Array.isArray(n) ? n : J[n]);
    let a, b;
    if (gu.tipo === 'linea') { a = at(gu.de); b = at(gu.a); }
    if (gu.tipo === 'vertical') { const p = at(gu.desde); a = p; b = [p[0], p[1] + (gu.largo ?? 70)]; }
    if (gu.tipo === 'horizontal') { const p = at(gu.en); a = [p[0] - (gu.largo ?? 60), p[1]]; b = [p[0] + (gu.largo ?? 60), p[1]]; }
    if (gu.tipo === 'segmento') { const s = SEG[gu.seg]; a = J[s[0]]; b = J[s[1]]; const dx = b[0] - a[0], dy = b[1] - a[1], k = 0.25; a = [a[0] - dx * k, a[1] - dy * k]; b = [b[0] + dx * k, b[1] + dy * k]; }
    if (!a || !b) continue;
    linea(g, a, b, 'guia', 1.6);
    if (gu.texto) {
      // Texto adentro del cuadro: en la horizontal arriba del extremo izquierdo; en el resto, centrado arriba del extremo final.
      const ref = gu.tipo === 'horizontal' ? a : b;
      const [tx, ty] = P(ref);
      const ancla = gu.tipo === 'horizontal' ? 'start' : (tx > 40 ? 'end' : tx < -40 ? 'start' : 'middle');
      const t = el('text', { x: tx, y: ty - 5, class: 'guia-txt', 'text-anchor': ancla }); t.textContent = gu.texto; g.appendChild(t);
    }
  }
}

function dibujarMusculos(g, trabaja, J) {
  for (const m of trabaja || []) {
    const s = typeof m === 'string' ? { seg: m } : m;
    if (s.seg === 'gluteo' || s.seg === 'gluteoI' || s.seg === 'gluteoD') {
      const c = J[s.seg === 'gluteoD' ? 'caderaD' : 'caderaI'] || J.pelvis;
      const [x, y] = P([c[0] - 5, c[1] - 2]); g.appendChild(el('circle', { cx: x, cy: y, r: 8, class: 'musculo' })); continue;
    }
    if (s.seg === 'hombroI' || s.seg === 'hombroD') { const [x, y] = P(J[s.seg]); g.appendChild(el('circle', { cx: x, cy: y, r: 7, class: 'musculo' })); continue; }
    const seg = SEG[s.seg]; if (!seg) continue;
    let a = J[seg[0]], b = J[seg[1]];
    if (s.lado) { // frente / atras: corre la marca hacia un costado del hueso (cuádriceps adelante, isquios atrás)
      const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1;
      let nx = -dy / n, ny = dx / n; if (nx < 0) { nx = -nx; ny = -ny; }
      const k = (s.lado === 'frente' ? 3.2 : -3.2);
      a = [a[0] + nx * k, a[1] + ny * k]; b = [b[0] + nx * k, b[1] + ny * k];
      const ka = 0.18; const ax = a[0] + (b[0] - a[0]) * ka, ay = a[1] + (b[1] - a[1]) * ka, bx = b[0] - (b[0] - a[0]) * ka, by = b[1] - (b[1] - a[1]) * ka;
      linea(g, [ax, ay], [bx, by], 'musculo-l', 6.5); continue;
    }
    linea(g, a, b, 'musculo-l', 8);
  }
}

function dibujarCuerpo(g, J, vista, cerca) {
  const lejos = cerca === 'I' ? 'D' : 'I';
  const parte = (lado, cls) => {
    for (const s of ['brazo', 'antebrazo', 'muslo', 'pierna']) linea(g, J[SEG[s + lado][0]], J[SEG[s + lado][1]], cls, s === 'muslo' ? 11 : s === 'pierna' ? 9 : s === 'brazo' ? 8.5 : 7.5);
    linea(g, J['pie' + lado], J['punta' + lado], cls, 6);
  };
  if (vista !== 'frente') parte(lejos, 'hueso lejos');
  linea(g, J.pelvis, J.cuello, 'hueso', 15);
  if (vista === 'frente') { linea(g, J.hombroI, J.hombroD, 'hueso', 9); linea(g, J.caderaI, J.caderaD, 'hueso', 10); }
  const [cx, cy] = P(J.cabeza); g.appendChild(el('circle', { cx, cy, r: L.cabeza, class: 'cabeza' }));
  if (vista === 'frente') { parte('I', 'hueso'); parte('D', 'hueso'); } else parte(cerca, 'hueso');
}

// Crea un muñeco animado en un contenedor. Devuelve { parar, fase }.
export function animar(contenedor, anim, { alFase } = {}) {
  const vista = anim.vista || 'lado';
  const cerca = anim.cerca || 'I';
  const svg = el('svg', { viewBox: anim.encuadre || '-110 -205 220 215', class: 'muneco', role: 'img', 'aria-label': anim.descripcion || 'Demostración animada' });
  const suelo = el('line', { x1: -110, y1: 0, x2: 110, y2: 0, class: 'suelo' });
  const capa = el('g');
  svg.append(suelo, capa);
  contenedor.replaceChildren(svg);
  const poses = anim.poses || [];
  const durs = poses.map((p) => (p.dur ?? 1) + (p.pausa ?? 0));
  const total = durs.reduce((a, b) => a + b, 0) || 1;
  let t0 = performance.now(), raf = 0, faseAnt = '';
  const quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cuadro(now) {
    let t = quieto ? 0 : ((now - t0) / 1000) % total;
    let i = 0; while (t > durs[i] && i < poses.length - 1) { t -= durs[i]; i++; }
    const a = poses[i], b = poses[(i + 1) % poses.length];
    const espera = a.pausa ?? 0;
    const k = t <= espera ? 0 : ease(Math.min(1, (t - espera) / (a.dur ?? 1)));
    const pose = mezclar(a, b, k);
    const J = esqueleto(pose, vista);
    capa.replaceChildren();
    dibujarEquipo(capa, anim.equipo, J, vista, false);
    dibujarCuerpo(capa, J, vista, cerca);
    dibujarMusculos(capa, anim.trabaja, J);
    dibujarEquipo(capa, anim.equipo, J, vista, true);
    dibujarGuias(capa, anim.guias, J);
    const fase = a.fase || '';
    if (fase !== faseAnt) { faseAnt = fase; if (alFase) alFase(fase); }
    if (!quieto) raf = requestAnimationFrame(cuadro);
  }
  raf = requestAnimationFrame(cuadro);
  return { parar: () => cancelAnimationFrame(raf) };
}
