// Plan de gimnasio — Hoy, entrada en calor y sesión completa del día.
// El plan se lee de plan.json (siempre la última versión). Los registros se guardan por id de ejercicio.
import { animar } from './muneco.js?v=202611121239';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const TILDE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DIAS = ['A', 'B', 'C'];

let plan = null;
const st = {
  vista: 'hoy', semana: leer('gym.semana', 1), dia: null, torneo: false,
  pasos: [], i: 0, sesion: {}, munecos: [], cal: {},
};

async function cargarPlan() {
  try { const r = await fetch('plan.json?v=' + Date.now(), { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { /* sin red */ }
  return leer('gym.plan', null);
}

const todos = () => [...Object.values(plan.dias).flatMap((d) => d.ejercicios), ...(plan.extras || [])];
const ejercicio = (id) => todos().find((e) => e.id === id);
const etapa = (sem) => plan.etapas.find((e) => sem >= e.semanas[0] && sem <= e.semanas[1]) || plan.etapas[0];
const esDescarga = (sem) => plan.descarga.semanas.includes(sem);
const sesiones = () => leer('gym.sesiones', []);

function diaSugerido() {
  const s = sesiones(); if (!s.length) return 'A';
  const ult = s[s.length - 1].dia; return DIAS[(DIAS.indexOf(ult) + 1) % DIAS.length];
}
function racha() {
  // Semanas seguidas (hasta esta) con al menos 2 entrenamientos.
  const s = sesiones(); if (!s.length) return 0;
  const lunes = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const porSemana = {}; s.forEach((x) => { const k = lunes(x.fecha); porSemana[k] = (porSemana[k] || 0) + 1; });
  let n = 0; const d = new Date(lunes(hoyISO()) + 'T12:00:00');
  if (!porSemana[d.toISOString().slice(0, 10)]) d.setDate(d.getDate() - 7);
  while (porSemana[d.toISOString().slice(0, 10)] >= 2 || (n === 0 && porSemana[d.toISOString().slice(0, 10)])) { n++; d.setDate(d.getDate() - 7); }
  return n;
}

// "3×8–10" → { n: 3, reps: "8–10", tope: 10 }; descarga: una serie menos (mínimo 2)
function receta(ej, sem) {
  const k = etapa(sem).id - 1;
  const txt = (ej.series && ej.series[k]) || '3×10';
  if (txt === '–') return null;
  const m = txt.match(/^(\d+)\s*[×x]\s*(.+)$/);
  let n = m ? +m[1] : 3; const reps = m ? m[2].trim() : txt;
  if (esDescarga(sem)) n = Math.max(2, n - 1);
  const nums = reps.match(/\d+/g) || []; const tope = nums.length ? +nums[nums.length - 1] : null;
  const seg = /s$/.test(reps);
  return { n, reps, tope, seg, nombre: (ej.nombreEtapa && ej.nombreEtapa[k]) || ej.nombre, nota: (ej.nota && ej.nota[k]) || '' };
}
function activo(ej, sem) { return !(ej.desdeSemana && sem < ej.desdeSemana) && receta(ej, sem); }
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const descTxt = (s) => (s >= 60 ? (s % 60 ? mmss(s) : `${s / 60} min`) : `${s} s`);

// Registros por id de ejercicio
const registros = () => leer('gym.registros', {});
function ultima(id) { const r = (registros()[id] || []).filter((x) => x.fecha !== hoyISO()); return r.length ? r[r.length - 1] : null; }
function sugerir(ej, ult, rec) {
  if (!ult || !ult.series.length || rec.seg) return '';
  const completas = ult.series.every((s) => s.hecha && (rec.tope == null || +s.reps >= rec.tope));
  if (!completas) return '';
  const pg = plan.progresion; const piernas = ej.grupo === 'piernas';
  const [a, b] = piernas ? pg.piernas : pg.torso;
  const kg = Math.max(...ult.series.map((s) => +s.kg || 0)); if (!kg) return '';
  return `Completaste todo la última vez: subí ${a}–${b} kg${piernas ? '' : ' por ' + pg.torsoPor} (de ${kg} a ${kg + a}–${kg + b} kg).`;
}
function videoUrl(ej) {
  if (ej.video && ej.video.url) return ej.video.url;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ej.nombre + ' técnica correcta');
}

function pararMunecos() { st.munecos.forEach((m) => m.parar()); st.munecos = []; }

// ---------------- HOY ----------------
function renderHoy() {
  pararMunecos();
  const sem = st.semana, et = etapa(sem), dia = st.dia || diaSugerido(), D = plan.dias[dia];
  const lista = D.ejercicios.filter((e) => activo(e, sem));
  const n = sesiones().length, r = racha();
  $('#app').innerHTML = `
  <header class="top">
    <div class="fila"><span class="eyebrow">${esc(hoyFecha())}</span><span class="eyebrow">${n} entrenamiento${n === 1 ? '' : 's'}${r ? ` · racha ${r} sem.` : ''}</span></div>
    <h1>Hoy te toca el Día ${dia}</h1>
    <div class="sub">${esc(D.nombre)}</div>
    <div class="chips">${DIAS.map((d) => `<button class="chip" data-dia="${d}" aria-pressed="${d === dia}">Día ${d}</button>`).join('')}</div>
  </header>
  <main class="wrap">
    <section class="card">
      <div class="ej-n">SEMANA ${sem} DE ${plan.semanas} · ${esc(et.nombre.toUpperCase())}</div>
      <p style="margin:6px 0 10px;font-weight:600">${esc(et.tanque)}. ${esc(et.saltos)}.${esDescarga(sem) ? '<br><span class="tanque">Semana de descarga: una serie menos en cada ejercicio.</span>' : ''}</p>
      <div class="chips chips-claro">${Array.from({ length: plan.semanas }, (_, k) => k + 1).map((s) => `<button class="chip" data-sem="${s}" aria-pressed="${s === sem}">${s}</button>`).join('')}</div>
    </section>
    ${D.aviso ? `<label class="card fila-torneo"><span><b>Tengo torneo esta semana</b><br><small>${esc(D.aviso)}</small></span><input type="checkbox" id="torneo" ${st.torneo ? 'checked' : ''}></label>` : ''}
    <section class="card lista">
      <div class="ej-n">ENTRADA EN CALOR · ${plan.calentamiento.minutos} MIN</div>
      <div class="lista-item texto">${plan.calentamiento.items.map((c) => esc(c.nombre)).join(' · ')}</div>
    </section>
    <section class="card lista">
      <div class="ej-n">${lista.length} EJERCICIOS</div>
      ${lista.map((e, k) => { const rc = receta(e, sem); const salta = st.torneo && (D.saltearAntesTorneo || []).includes(k + 1); return `<div class="lista-item ${salta ? 'saltado' : ''}"><span class="num">${k + 1}</span><span>${esc(rc.nombre)}${e.extraIzq ? ' <small class="izq">+1 izq.</small>' : ''}</span><b class="num">${rc.n}×${esc(rc.reps)}</b></div>`; }).join('')}
    </section>
  </main>
  <nav class="nav"><div class="in uno"><button class="btn prim grande" data-act="empezar" data-d="${dia}">Empezar Día ${dia}</button></div></nav>`;
}
function hoyFecha() { return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); }

// ---------------- SESIÓN ----------------
function armarPasos(dia) {
  const D = plan.dias[dia];
  const pasos = [{ tipo: 'calor' }];
  D.ejercicios.forEach((e, k) => {
    if (!activo(e, st.semana)) return;
    if (st.torneo && (D.saltearAntesTorneo || []).includes(k + 1)) return;
    pasos.push({ tipo: 'ej', id: e.id });
  });
  return pasos;
}

function renderCalor() {
  pararMunecos();
  const items = plan.calentamiento.items;
  $('#app').innerHTML = `
  <header class="top"><div class="fila"><span class="eyebrow">Día ${st.dia} · Semana ${st.semana}</span><button class="chip" data-act="salir">Salir</button></div><h1>Entrada en calor</h1><div class="sub">${plan.calentamiento.minutos} minutos · tocá cada uno al terminarlo</div></header>
  <main class="wrap">${barraSesion()}
    <section class="series">${items.map((c) => `<button class="serie calor ${st.cal[c.id] ? 'hecha' : ''}" data-act="calor" data-id="${c.id}"><span class="calor-txt"><b>${esc(c.nombre)}</b><small>${esc(c.dosis)}</small></span><span class="check">${TILDE}</span></button>`).join('')}</section>
  </main>
  <nav class="nav"><div class="in"><button class="btn" data-act="salir">← Hoy</button><button class="btn prim" data-act="sig">Empezar ejercicios →</button></div></nav>`;
}

function barraSesion() { return `<div class="barra-sesion">${st.pasos.map((p, k) => `<i class="${k < st.i ? 'hecho' : k === st.i ? 'actual' : ''}"></i>`).join('')}</div>`; }

function bloqueDemo(ej, etiqueta) {
  const a = ej.anim;
  return `<section class="demo">${etiqueta ? `<div class="demo-tit">${esc(etiqueta)}</div>` : ''}
    ${a ? `<div class="lienzo" data-anim="${esc(ej.id)}"></div><div class="fase" data-fase="${esc(ej.id)}"></div>
    <div class="leyenda"><span><i style="background:var(--acento)"></i>Trabaja</span><span><i style="background:var(--guia)"></i>Guía</span><span>${a.vista === 'frente' ? 'De frente' : 'De costado'}</span></div>`
      : '<div class="sin-anim">Animación en preparación</div>'}
  </section>`;
}
function bloqueInfo(ej, titulo) {
  const t = titulo ? ` · ${esc(titulo)}` : '';
  return `
    <details class="info" ${titulo ? '' : 'open'}><summary>Cómo hacerlo bien${t}</summary><div class="body"><ol>${(ej.pasos || []).map((p) => `<li>${esc(p)}</li>`).join('') || '<li>Pronto.</li>'}</ol></div></details>
    <details class="info"><summary>Errores a evitar${t}</summary><div class="body"><ul>${(ej.errores || []).map((p) => `<li>${esc(p)}</li>`).join('') || '<li>Pronto.</li>'}</ul></div></details>
    <details class="info"><summary>Por qué lo hacés${t}</summary><div class="body"><p>${esc(ej.porque || 'Pronto.')}</p></div></details>
    <a class="btn video" href="${esc(videoUrl(ej))}" target="_blank" rel="noopener">▶ Ver video real${titulo ? ' · ' + esc(titulo) : ''}${ej.video && ej.video.canal ? `<small>${esc(ej.video.canal)}</small>` : ''}</a>`;
}

function renderEj() {
  pararMunecos();
  const sem = st.semana, paso = st.pasos[st.i], ej = ejercicio(paso.id), rec = receta(ej, sem);
  const comps = (ej.superserie || []).map(ejercicio).filter(Boolean);
  const ses = st.sesion[ej.id] || (st.sesion[ej.id] = { series: [] });
  const total = rec.n + (ej.extraIzq ? 1 : 0);
  const ult = ultima(ej.id);
  for (let k = 0; k < total; k++) if (!ses.series[k]) ses.series[k] = { kg: ult && ult.series[k] ? ult.series[k].kg : '', reps: '', hecha: false };
  ses.series.length = total;
  const nEj = st.pasos.filter((p) => p.tipo === 'ej').length, idx = st.pasos.slice(0, st.i + 1).filter((p) => p.tipo === 'ej').length;
  const sug = sugerir(ej, ult, rec);
  $('#app').innerHTML = `
  <header class="top"><div class="fila"><span class="eyebrow">Día ${st.dia} · Semana ${sem} · ${esc(etapa(sem).nombre)}</span><button class="chip" data-act="salir">Salir</button></div>
    <div class="sub" style="margin-top:6px">${esc(etapa(sem).tanque)}${esDescarga(sem) ? ' · descarga' : ''}</div></header>
  <main class="wrap">${barraSesion()}
    ${comps.length ? `<div class="doble">${comps.map((c, k) => bloqueDemo(c, (k + 1) + '. ' + c.nombre)).join('')}</div>` : bloqueDemo(ej)}
    <section class="card">
      <div class="ej-n">EJERCICIO ${idx} DE ${nEj}</div><h2 class="ej-tit">${esc(rec.nombre)}</h2>
      <div class="presc">
        <div><b class="num">${rec.n}</b><span>Series</span></div>
        <div><b class="num">${esc(rec.reps)}</b><span>${rec.seg ? 'Tiempo' : 'Reps'}${ej.por ? ' ' + esc(ej.por) : ''}</span></div>
        <div><b class="num">${descTxt(ej.descanso)}</b><span>Descanso</span></div>
      </div>
      ${rec.nota ? `<div class="tanque">${esc(rec.nota)}</div>` : ''}
      ${ej.notaExtra ? `<div class="tanque">${esc(ej.notaExtra)}</div>` : ''}
      ${ej.extraIzq ? '<span class="extra">+1 serie extra con la izquierda · empezá por la izquierda</span>' : ''}
      ${ult ? `<p class="ultima">La última vez (${esc(ult.fecha)}): <b>${ult.series.filter((s) => s.hecha).map((s) => `${s.kg || '–'} kg × ${s.reps || '–'}`).join(' · ') || 'sin series marcadas'}</b></p>` : `<p class="ultima">Primera vez: anotá ${rec.seg ? 'el tiempo' : 'los kilos y las repeticiones'} de cada serie.</p>`}
      ${sug ? `<div class="sugerencia">↑ ${esc(sug)}</div>` : ''}
    </section>
    <section class="series">${ses.series.map((s, k) => `
      <div class="serie ${s.hecha ? 'hecha' : ''}">
        <div class="n num">${k + 1}${ej.extraIzq && k === total - 1 ? '<small>IZQ.</small>' : ''}</div>
        <div class="campo"><label for="kg${k}">Kilos</label><input id="kg${k}" inputmode="decimal" data-f="kg" data-k="${k}" value="${esc(s.kg)}" placeholder="0"></div>
        <div class="campo"><label for="rp${k}">${rec.seg ? 'Seg.' : 'Reps'}</label><input id="rp${k}" inputmode="numeric" data-f="reps" data-k="${k}" value="${esc(s.reps)}" placeholder="${esc(String(rec.tope ?? ''))}"></div>
        <button class="check" data-act="serie" data-k="${k}" aria-label="Marcar serie ${k + 1} hecha" aria-pressed="${s.hecha}">${TILDE}</button>
      </div>`).join('')}
    </section>
    <div class="botones" style="margin-top:12px"><button class="btn duele" data-act="duele">Me duele</button><button class="btn" data-act="sig">Saltear</button></div>
    ${comps.length ? `<details class="info" open><summary>Cómo es la superserie</summary><div class="body"><ol>${(ej.pasos || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div></details>${comps.map((c) => bloqueInfo(c, c.nombre)).join('')}` : bloqueInfo(ej)}
  </main>
  <nav class="nav"><div class="in"><button class="btn" data-act="ant">← Anterior</button><button class="btn prim" data-act="sig">${st.i === st.pasos.length - 1 ? 'Terminar sesión' : 'Siguiente →'}</button></div></nav>`;
  document.querySelectorAll('[data-anim]').forEach((nodo) => {
    const e = ejercicio(nodo.dataset.anim);
    st.munecos.push(animar(nodo, e.anim, { alFase: (f) => { const x = document.querySelector(`[data-fase="${CSS.escape(e.id)}"]`); if (x) x.textContent = f; } }));
  });
}

function render() {
  if (st.vista === 'hoy') return renderHoy();
  const p = st.pasos[st.i];
  if (p.tipo === 'calor') return renderCalor();
  return renderEj();
}

// ---------------- Cronómetro ----------------
const crono = { fin: 0, timer: 0 };
let audio = null;
function pitido() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    for (const [f, d] of [[880, 0], [880, 0.25], [1320, 0.5]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + d); g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.2);
      o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.22);
    }
  } catch { /* sin sonido */ }
  if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
}
function abrirCrono(seg, texto) {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* */ }
  crono.fin = Date.now() + seg * 1000;
  const c = $('#crono'); c.classList.add('abierto'); c.classList.remove('fin');
  $('#cronoSig').textContent = texto;
  clearInterval(crono.timer); tick(); crono.timer = setInterval(tick, 250);
}
function tick() {
  const rest = Math.max(0, Math.ceil((crono.fin - Date.now()) / 1000));
  $('#cronoT').textContent = mmss(rest);
  if (rest === 0) { clearInterval(crono.timer); $('#crono').classList.add('fin'); $('#cronoLbl').textContent = '¡Dale, otra serie!'; pitido(); setTimeout(cerrarCrono, 4000); }
  else $('#cronoLbl').textContent = 'Descanso';
}
function cerrarCrono() { clearInterval(crono.timer); $('#crono').classList.remove('abierto', 'fin'); }

// ---------------- Guardado ----------------
function guardarEj(id) {
  const ses = st.sesion[id]; if (!ses || !ses.series.some((s) => s.hecha)) return;
  const r = registros(); const lista = r[id] || (r[id] = []);
  const reg = { fecha: hoyISO(), semana: st.semana, dia: st.dia, series: ses.series.map((s) => ({ kg: s.kg, reps: s.reps, hecha: s.hecha })) };
  if (lista.length && lista[lista.length - 1].fecha === reg.fecha) lista[lista.length - 1] = reg; else lista.push(reg);
  guardar('gym.registros', r);
}
function terminar() {
  Object.keys(st.sesion).forEach(guardarEj);
  const s = sesiones(); const hechos = Object.values(st.sesion).filter((x) => x.series.some((y) => y.hecha)).length;
  s.push({ fecha: hoyISO(), dia: st.dia, semana: st.semana, ejercicios: hechos }); guardar('gym.sesiones', s);
  st.vista = 'hoy'; st.dia = null; st.sesion = {}; st.cal = {}; cerrarCrono(); render(); scrollTo(0, 0);
  toast('Sesión guardada. ¡Bien ahí!');
}
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }

function hojaDuele(ej) {
  const velo = document.createElement('div'); velo.className = 'velo';
  const h = document.createElement('div'); h.className = 'hoja';
  h.innerHTML = `<h3>¿Dónde te duele?</h3><p>${esc(ej.nombre)}</p><div class="opc">${plan.molestias.map((m) => `<button class="btn" data-m="${esc(m)}">${esc(m.charAt(0).toUpperCase() + m.slice(1))}</button>`).join('')}</div><button class="btn" data-m="">Cancelar</button>`;
  const cerrar = () => { velo.remove(); h.remove(); };
  velo.onclick = cerrar;
  h.onclick = (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    if (!b.dataset.m) return cerrar();
    const lista = leer('gym.molestias', []); lista.push({ fecha: hoyISO(), id: ej.id, ejercicio: ej.nombre, zona: b.dataset.m }); guardar('gym.molestias', lista);
    h.innerHTML = `<h3>Anotado</h3><div class="aviso">Cortá este ejercicio por hoy y consultalo con tu kinesióloga antes de volver a hacerlo.</div><p>Molestia en ${esc(b.dataset.m)} · ${esc(ej.nombre)} · ${hoyISO()}</p><button class="btn prim" data-m="">Entendido</button>`;
  };
  document.body.append(velo, h);
}

// ---------------- Eventos ----------------
document.addEventListener('input', (e) => {
  const f = e.target.dataset.f; if (!f) return;
  const id = st.pasos[st.i].id; st.sesion[id].series[+e.target.dataset.k][f] = e.target.value.replace(',', '.');
});
document.addEventListener('change', (e) => { if (e.target.id === 'torneo') { st.torneo = e.target.checked; render(); } });
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-sem],[data-dia]'); if (!b) return;
  if (b.dataset.sem) { st.semana = +b.dataset.sem; guardar('gym.semana', st.semana); render(); return; }
  if (b.dataset.dia) { st.dia = b.dataset.dia; render(); return; }
  const a = b.dataset.act;
  if (a === 'empezar') { st.dia = b.dataset.d; st.pasos = armarPasos(st.dia); st.i = 0; st.sesion = {}; st.cal = {}; st.vista = 'sesion'; render(); scrollTo(0, 0); return; }
  if (a === 'salir') { Object.keys(st.sesion).forEach(guardarEj); cerrarCrono(); st.vista = 'hoy'; render(); scrollTo(0, 0); return; }
  if (a === 'calor') { st.cal[b.dataset.id] = !st.cal[b.dataset.id]; render(); return; }
  if (a === 'mas15') { crono.fin += 15000; tick(); return; }
  if (a === 'saltar') { cerrarCrono(); return; }
  const paso = st.pasos[st.i];
  if (a === 'serie') {
    const ej = ejercicio(paso.id); const k = +b.dataset.k; const s = st.sesion[ej.id].series[k];
    s.hecha = !s.hecha;
    if (s.hecha && !s.reps) s.reps = String(receta(ej, st.semana).tope ?? '');
    guardarEj(ej.id);
    const quedan = st.sesion[ej.id].series.filter((x) => !x.hecha).length;
    render();
    if (s.hecha) abrirCrono(ej.descanso, quedan ? `Después: serie ${k + 2} de ${st.sesion[ej.id].series.length}` : 'Terminaste este ejercicio: pasá al siguiente');
    return;
  }
  if (a === 'sig') { if (paso.tipo === 'ej') guardarEj(paso.id); cerrarCrono(); if (st.i < st.pasos.length - 1) { st.i++; render(); scrollTo(0, 0); } else terminar(); return; }
  if (a === 'ant') { cerrarCrono(); st.i = Math.max(0, st.i - 1); render(); scrollTo(0, 0); return; }
  if (a === 'duele') hojaDuele(ejercicio(paso.id));
});

(async function iniciar() {
  plan = await cargarPlan();
  if (!plan) { $('#app').innerHTML = '<main class="wrap"><div class="card">No se pudo cargar el plan. Revisá la conexión.</div></main>'; return; }
  guardar('gym.plan', plan);
  render();
})();
