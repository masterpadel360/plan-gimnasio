// Plan de gimnasio — modo entrenamiento (versión de prueba con 3 ejercicios animados).
// El plan se lee de plan.json. Los registros se guardan por id de ejercicio (en esta prueba, en el celu; después, en Firebase).
import { animar } from './muneco.js';

const PRUEBA = ['sentadilla-bulgara', 'peso-muerto-rumano', 'elevaciones-laterales'];
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoyISO = () => new Date().toISOString().slice(0, 10);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };
const TILDE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let plan = null;
const st = { semana: leer('gym.semana', 1), i: 0, sesion: {}, muneco: null };

async function cargarPlan() {
  const url = 'plan.json?v=' + Date.now(); // siempre la última versión del plan
  try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch { /* sin red: probamos con la copia */ }
  return leer('gym.plan', null);
}

const todos = () => Object.values(plan.dias).flatMap((d) => d.ejercicios);
const ejercicio = (id) => todos().find((e) => e.id === id);
const etapa = (sem) => plan.etapas.find((e) => sem >= e.semanas[0] && sem <= e.semanas[1]) || plan.etapas[0];
const esDescarga = (sem) => plan.descarga.semanas.includes(sem);

// "3×8–10" → { n: 3, reps: "8–10", tope: 10 }; descarga: una serie menos (mínimo 2)
function receta(ej, sem) {
  const k = etapa(sem).id - 1;
  const txt = (ej.series && ej.series[k]) || '3×10';
  const m = txt.match(/^(\d+)\s*[×x]\s*(.+)$/);
  let n = m ? +m[1] : 3; const reps = m ? m[2].trim() : txt;
  if (esDescarga(sem)) n = Math.max(2, n - 1);
  const nums = reps.match(/\d+/g) || []; const tope = nums.length ? +nums[nums.length - 1] : null;
  return { n, reps, tope, nombre: (ej.nombreEtapa && ej.nombreEtapa[k]) || ej.nombre, nota: (ej.nota && ej.nota[k]) || '' };
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const descTxt = (s) => (s >= 60 ? (s % 60 ? mmss(s) : `${s / 60} min`) : `${s} s`);

// Registros por id de ejercicio
const registros = () => leer('gym.registros', {});
function ultima(id) { const r = (registros()[id] || []).filter((x) => x.fecha !== hoyISO()); return r.length ? r[r.length - 1] : null; } // la sesión anterior (no la de hoy)
function sugerir(ej, ult, rec) {
  if (!ult || !ult.series.length) return '';
  const completas = ult.series.every((s) => s.hecha && (rec.tope == null || +s.reps >= rec.tope));
  if (!completas) return '';
  const pg = plan.progresion;
  const piernas = ej.grupo === 'piernas';
  const [a, b] = piernas ? pg.piernas : pg.torso;
  const kg = Math.max(...ult.series.map((s) => +s.kg || 0));
  if (!kg) return '';
  return `Completaste todo la última vez: subí ${a}–${b} kg${piernas ? '' : ' por ' + pg.torsoPor} (de ${kg} a ${kg + a}–${kg + b} kg).`;
}

function render() {
  const sem = st.semana, et = etapa(sem);
  const id = PRUEBA[st.i]; const ej = ejercicio(id); const rec = receta(ej, sem);
  const ses = st.sesion[id] || (st.sesion[id] = { series: [] });
  const total = rec.n + (ej.extraIzq ? 1 : 0);
  const ult = ultima(id);
  for (let k = 0; k < total; k++) if (!ses.series[k]) ses.series[k] = { kg: ult && ult.series[k] ? ult.series[k].kg : '', reps: '', hecha: false };
  ses.series.length = total;

  $('#app').innerHTML = `
  <header class="top">
    <div class="fila"><span class="eyebrow">Prueba · modo entrenamiento</span></div>
    <h1>Semana ${sem} · ${esc(et.nombre)}</h1>
    <div class="sub">${esc(et.tanque)}${esDescarga(sem) ? ' · <b>Semana de descarga</b>: una serie menos' : ''}</div>
    <div class="chips">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((s) => `<button class="chip" data-sem="${s}" aria-pressed="${s === sem}">${s}</button>`).join('')}</div>
  </header>
  <main class="wrap">
    <div class="barra-sesion">${PRUEBA.map((p, k) => `<i class="${k < st.i ? 'hecho' : k === st.i ? 'actual' : ''}"></i>`).join('')}</div>
    <section class="demo" aria-label="Demostración">
      <div class="lienzo" id="lienzo"></div>
      <div class="fase" id="fase"></div>
      <div class="leyenda"><span><i style="background:var(--acento)"></i>Trabaja</span><span><i style="background:var(--guia)"></i>Guía</span>${ej.anim && ej.anim.vista === 'frente' ? '<span>Vista de frente</span>' : '<span>Vista de costado</span>'}</div>
    </section>
    <section class="card">
      <div class="ej-head"><div><div class="ej-n">EJERCICIO ${st.i + 1} DE ${PRUEBA.length}</div><h2>${esc(rec.nombre)}</h2></div></div>
      <div class="presc">
        <div><b class="num">${rec.n}</b><span>Series</span></div>
        <div><b class="num">${esc(rec.reps)}</b><span>Reps${ej.por ? ' ' + esc(ej.por.replace('por ', 'x ')) : ''}</span></div>
        <div><b class="num">${descTxt(ej.descanso)}</b><span>Descanso</span></div>
      </div>
      ${rec.nota ? `<div class="tanque">${esc(rec.nota)}</div>` : ''}
      ${ej.extraIzq ? '<span class="extra">+1 serie extra con la izquierda · empezá por la izquierda</span>' : ''}
      ${ult ? `<p class="ultima">La última vez (${esc(ult.fecha)}): <b>${ult.series.filter((s) => s.hecha).map((s) => `${s.kg || '–'} kg × ${s.reps || '–'}`).join(' · ') || 'sin series marcadas'}</b></p>` : '<p class="ultima">Primera vez con este ejercicio: anotá los kilos y las repeticiones de cada serie.</p>'}
      ${sugerir(ej, ult, rec) ? `<div class="sugerencia">↑ ${esc(sugerir(ej, ult, rec))}</div>` : ''}
    </section>
    <section class="series">${ses.series.map((s, k) => `
      <div class="serie ${s.hecha ? 'hecha' : ''}" data-k="${k}">
        <div class="n num">${k + 1}${ej.extraIzq && k === total - 1 ? '<small>IZQ.</small>' : ''}</div>
        <div class="campo"><label for="kg${k}">Kilos</label><input id="kg${k}" inputmode="decimal" data-f="kg" data-k="${k}" value="${esc(s.kg)}" placeholder="0"></div>
        <div class="campo"><label for="rp${k}">Reps</label><input id="rp${k}" inputmode="numeric" data-f="reps" data-k="${k}" value="${esc(s.reps)}" placeholder="${esc(String(rec.tope ?? ''))}"></div>
        <button class="check" data-act="serie" data-k="${k}" aria-label="Marcar serie ${k + 1} hecha" aria-pressed="${s.hecha}">${TILDE}</button>
      </div>`).join('')}
    </section>
    <div class="botones" style="margin-top:12px">
      <a class="btn" href="${esc(videoUrl(ej))}" target="_blank" rel="noopener">▶ Ver video real</a>
      <button class="btn duele" data-act="duele">Me duele</button>
    </div>
    <details class="info" open><summary>Cómo hacerlo bien</summary><div class="body"><ol>${(ej.pasos || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div></details>
    <details class="info"><summary>Errores a evitar</summary><div class="body"><ul>${(ej.errores || []).map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div></details>
    <details class="info"><summary>Por qué lo hacés</summary><div class="body"><p>${esc(ej.porque || '')}</p></div></details>
  </main>
  <nav class="nav"><div class="in">
    <button class="btn" data-act="ant" ${st.i === 0 ? 'disabled style="opacity:.4"' : ''}>← Anterior</button>
    <button class="btn prim" data-act="sig">${st.i === PRUEBA.length - 1 ? 'Terminar sesión' : 'Siguiente ejercicio →'}</button>
  </div></nav>`;

  if (st.muneco) st.muneco.parar();
  if (ej.anim) st.muneco = animar($('#lienzo'), ej.anim, { alFase: (f) => { const el = $('#fase'); if (el) el.textContent = f; } });
}

function videoUrl(ej) {
  if (ej.video && ej.video.url) return ej.video.url;
  return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ej.nombre + ' técnica correcta');
}

// --- Cronómetro de descanso ---
const crono = { fin: 0, timer: 0, total: 0 };
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
  crono.fin = Date.now() + seg * 1000; crono.total = seg;
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

function guardarSesion(id) {
  const ses = st.sesion[id]; if (!ses || !ses.series.some((s) => s.hecha)) return;
  const r = registros(); const lista = r[id] || (r[id] = []);
  const hoy = hoyISO();
  const reg = { fecha: hoy, semana: st.semana, series: ses.series.map((s) => ({ kg: s.kg, reps: s.reps, hecha: s.hecha })) };
  if (lista.length && lista[lista.length - 1].fecha === hoy) lista[lista.length - 1] = reg; else lista.push(reg);
  guardar('gym.registros', r);
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

document.addEventListener('input', (e) => {
  const f = e.target.dataset.f; if (!f) return;
  const id = PRUEBA[st.i]; st.sesion[id].series[+e.target.dataset.k][f] = e.target.value.replace(',', '.');
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act],[data-sem]'); if (!b) return;
  if (b.dataset.sem) { st.semana = +b.dataset.sem; guardar('gym.semana', st.semana); st.sesion = {}; render(); return; }
  const id = PRUEBA[st.i]; const ej = ejercicio(id);
  const a = b.dataset.act;
  if (a === 'serie') {
    const k = +b.dataset.k; const s = st.sesion[id].series[k];
    s.hecha = !s.hecha;
    if (s.hecha && !s.reps) s.reps = String(receta(ej, st.semana).tope ?? '');
    guardarSesion(id);
    const quedan = st.sesion[id].series.filter((x) => !x.hecha).length;
    render();
    if (s.hecha) abrirCrono(ej.descanso, quedan ? `Después: serie ${k + 2} de ${st.sesion[id].series.length}` : 'Terminaste este ejercicio: pasá al siguiente');
  }
  if (a === 'sig') { guardarSesion(id); cerrarCrono(); if (st.i < PRUEBA.length - 1) { st.i++; render(); scrollTo(0, 0); } else { toast('Sesión guardada. ¡Bien ahí!'); } }
  if (a === 'ant') { cerrarCrono(); st.i = Math.max(0, st.i - 1); render(); scrollTo(0, 0); }
  if (a === 'duele') hojaDuele(ej);
  if (a === 'mas15') { crono.fin += 15000; tick(); }
  if (a === 'saltar') cerrarCrono();
});

(async function iniciar() {
  plan = await cargarPlan();
  if (!plan) { $('#app').innerHTML = '<main class="wrap"><div class="card">No se pudo cargar el plan. Revisá la conexión.</div></main>'; return; }
  guardar('gym.plan', plan);
  render();
})();
