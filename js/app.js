// Plan de gimnasio — Hoy, entrada en calor y sesión completa del día.
// El plan se lee de plan.json (siempre la última versión). Los registros se guardan por id de ejercicio.
import { animar } from './muneco.js?v=202611121347';
import { iniciarNube, entrar, salir, conectado, mailActual, marcarCambio, estado as nube } from './nube.js?v=202611121347';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
// Todo lo que guardo (menos la copia del plan) también se sube a la nube.
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } if (k !== 'gym.plan') marcarCambio(); };
const TILDE = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let DIAS = ['A', 'B', 'C']; // se toma del plan (plan.orden o las claves de plan.dias): así un plan de 5 días funciona igual

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
function sugerir(ej, ult, rec, anotar = 'total') {
  if (!ult || !ult.series.length || rec.seg || anotar === 'ninguno') return '';
  const m = modoDe(ej); if (m && ult.modo && ult.modo !== m.id) return ''; // cambiaste de equipo: no se compara
  const completas = ult.series.every((s) => s.hecha && (rec.tope == null || +s.reps >= rec.tope));
  if (!completas) return '';
  const ok = 'Completaste todo la última vez: ';
  if (anotar === 'placa') return ok + 'subí un número de placa.';
  if (anotar === 'asistencia') return ok + 'bajá unos 5 kg de asistencia.';
  if (anotar === 'pelota') return ok + 'cuando lo sientas fácil, pasá a una pelota más pesada.';
  const pg = plan.progresion; const piernas = ej.grupo === 'piernas';
  const [a, b] = piernas ? pg.piernas : pg.torso;
  const kg = Math.max(...ult.series.map((s) => +s.kg || 0)); if (!kg) return '';
  const cual = anotar === 'por-mancuerna' ? ' por mancuerna' : anotar === 'total' ? ' en total' : '';
  return `${ok}subí ${a}–${b} kg${cual} (de ${kg} a ${kg + a}–${kg + b} kg).`;
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
  <nav class="nav con-tabs"><div class="in uno"><button class="btn prim grande" data-act="empezar" data-d="${dia}">Empezar Día ${dia}</button></div></nav>${tabs()}`;
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
  const abierto = items.find((c) => c.id === st.calAbierto);
  if (abierto) return renderCalorEj(abierto, items);
  const hechos = items.filter((c) => st.cal[c.id]).length;
  $('#app').innerHTML = `
  <header class="top"><div class="fila"><span class="eyebrow">Día ${st.dia} · Semana ${st.semana}</span><button class="chip" data-act="salir">Salir</button></div><h1>Entrada en calor</h1><div class="sub">${plan.calentamiento.minutos} minutos · ${hechos} de ${items.length} hechos · tocá uno para ver cómo se hace</div></header>
  <main class="wrap">${barraSesion()}
    <section class="series">${items.map((c, k) => `<div class="serie calor ${st.cal[c.id] ? 'hecha' : ''}"><button class="calor-abrir" data-act="calAbrir" data-id="${esc(c.id)}"><span class="calor-n num">${k + 1}</span><span class="calor-txt"><b>${esc(c.nombre)}</b><small>${esc(c.dosis)}${c.equipo ? ' · ' + esc(c.equipo) : ''}</small></span><span class="calor-ver" aria-hidden="true">›</span></button><button class="check" data-act="calor" data-id="${esc(c.id)}" aria-label="Tachar ${esc(c.nombre)}" aria-pressed="${!!st.cal[c.id]}">${TILDE}</button></div>`).join('')}</section>
  </main>
  <nav class="nav"><div class="in"><button class="btn" data-act="salir">← Hoy</button><button class="btn prim" data-act="sig">Empezar ejercicios →</button></div></nav>`;
}

// Un ejercicio de la entrada en calor: muñeco arriba, explicación abajo y botón para tacharlo.
function renderCalorEj(c, items) {
  const k = items.indexOf(c), hecho = !!st.cal[c.id];
  $('#app').innerHTML = `
  <header class="top"><div class="fila"><span class="eyebrow">Entrada en calor · ${k + 1} de ${items.length}</span><button class="chip" data-act="calLista">Lista</button></div></header>
  <main class="wrap">${barraSesion()}
    ${bloqueDemo(c)}
    <section class="card">
      <div class="ej-n">ENTRADA EN CALOR ${k + 1} DE ${items.length}</div><h2 class="ej-tit">${esc(c.nombre)}</h2>
      <div class="presc presc-2">
        <div><b class="num">${esc(c.dosis)}</b><span>Cantidad</span></div>
        <div><b class="calor-eq">${esc(c.equipo || 'Peso corporal')}</b><span>Con qué</span></div>
      </div>
      <button class="btn ${hecho ? '' : 'prim'} calor-hecho" data-act="calHecho" data-id="${esc(c.id)}" aria-pressed="${hecho}">${hecho ? '✓ Hecho · tocá para destachar' : 'Listo, lo hice ✓'}</button>
    </section>
    ${bloqueInfo(c)}
  </main>
  <nav class="nav"><div class="in"><button class="btn" data-act="calLista">← Lista</button><button class="btn prim" data-act="calSig">${k < items.length - 1 ? 'Siguiente →' : 'Ir a los ejercicios →'}</button></div></nav>`;
  document.querySelectorAll('[data-anim]').forEach((nodo) => {
    st.munecos.push(animar(nodo, c.anim, { alFase: (f) => { const x = document.querySelector(`[data-fase="${CSS.escape(c.id)}"]`); if (x) x.textContent = f; } }));
  });
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
// ---------------- Con qué lo hago ----------------
// Qué se anota en "kg" (siempre igual, para poder comparar).
const ANOTAR = { 'por-mancuerna': 'kg por mancuerna', mancuerna: 'kg de la mancuerna', total: 'kg totales', discos: 'kg en discos', placa: 'placa de la máquina', asistencia: 'kg asistencia (−)', agregado: 'kg agregados', pelota: 'kg de la pelota', ninguno: '' };
const ANOTAR_LARGO = {
  'por-mancuerna': 'Los kg de UNA mancuerna (no la suma de las dos).',
  mancuerna: 'Los kg de la mancuerna.',
  total: 'Los kg totales: la barra incluida más todos los discos.',
  discos: 'Los kg de todos los discos que cargaste en la máquina.',
  placa: 'El número de placa que marca la máquina.',
  asistencia: 'La asistencia en negativo (ej. −20). Si sumás peso con cinturón, en positivo.',
  agregado: 'Solo los kg que agregás (0 si es tu peso).',
  pelota: 'Los kg de la pelota.',
  ninguno: 'Nada de kilos: solo repeticiones o segundos.',
};
const porEtapa = (v, sem) => (Array.isArray(v) ? v[etapa(sem).id - 1] : v);
function modoDe(ej) {
  const o = ej.equipo && ej.equipo.opciones; if (!o) return null;
  const m = leer('gym.modos', {})[ej.id]; return o.find((x) => x.id === m) || o[0];
}
function equipoDe(ej, sem) {
  const e = ej.equipo || {}, m = modoDe(ej);
  return { elemento: porEtapa(e.elemento, sem), peso: m ? m.peso : porEtapa(e.peso, sem), progresar: porEtapa(e.progresar, sem), anotar: (m ? m.anotar : porEtapa(e.anotar, sem)) || 'total', opciones: e.opciones, modo: m ? m.id : null };
}
function bloqueEquipo(ej, sem, titulo) {
  if (!ej.equipo) return '';
  const q = equipoDe(ej, sem);
  return `<section class="card equipo"><div class="ej-n">CON QUÉ LO HAGO${titulo ? ' · ' + esc(titulo.toUpperCase()) : ''}</div>
    ${q.opciones ? `<div class="seg-op" role="group" aria-label="Con qué lo hacés">${q.opciones.map((o) => `<button data-act="modo" data-id="${esc(ej.id)}" data-v="${esc(o.id)}" aria-pressed="${o.id === q.modo}">${esc(o.nombre)}</button>`).join('')}</div>` : ''}
    <dl class="eq-dl">
      <dt>Elemento</dt><dd>${esc(q.elemento || '')}</dd>
      ${q.peso ? `<dt>Dónde va el peso</dt><dd>${esc(q.peso)}</dd>` : ''}
      ${q.progresar ? `<dt>Cuando te queda fácil</dt><dd>${esc(q.progresar)}</dd>` : ''}
      <dt>Qué anoto</dt><dd><b>${esc(ANOTAR_LARGO[q.anotar] || '')}</b></dd>
    </dl></section>`;
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
  for (let k = 0; k < total; k++) if (!ses.series[k]) ses.series[k] = { kg: ult && ult.series[k] ? ult.series[k].kg : '', kg2: ult && ult.series[k] ? (ult.series[k].kg2 ?? '') : '', reps: '', hecha: false };
  ses.series.length = total;
  const nEj = st.pasos.filter((p) => p.tipo === 'ej').length, idx = st.pasos.slice(0, st.i + 1).filter((p) => p.tipo === 'ej').length;
  // Campos de kg: uno por ejercicio (dos en las superseries), con la etiqueta de qué se anota. Sin campo si es peso corporal.
  const campos = (comps.length ? comps : [ej]).map((c, n) => ({ f: n ? 'kg2' : 'kg', anotar: equipoDe(c, sem).anotar, corto: comps.length ? c.nombre.split(' ')[0] : '' })).filter((c) => c.anotar !== 'ninguno');
  const unidad = (a) => (a === 'placa' ? 'placa' : 'kg');
  const sug = campos.length && !comps.length ? sugerir(ej, ult, rec, campos[0].anotar) : '';
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
      ${ult ? `<p class="ultima">La última vez (${esc(ult.fecha)}): <b>${ult.series.filter((s) => s.hecha).map((s) => [campos[0] ? `${s.kg || '–'} ${unidad(campos[0].anotar)}` : '', campos[1] ? `+ ${s.kg2 || '–'} ${unidad(campos[1].anotar)}` : '', `× ${s.reps || '–'}`].filter(Boolean).join(' ')).join(' · ') || 'sin series marcadas'}</b>${ult.modo && ult.modo !== (modoDe(ej) || {}).id ? ' <small>(con otra opción de equipo)</small>' : ''}</p>` : `<p class="ultima">Primera vez: anotá ${campos.length ? 'lo que dice al lado de cada campo' : (rec.seg ? 'el tiempo' : 'las repeticiones')} en cada serie.</p>`}
      ${sug ? `<div class="sugerencia">↑ ${esc(sug)}</div>` : ''}
    </section>
    ${comps.length ? comps.map((c) => bloqueEquipo(c, sem, c.nombre)).join('') : bloqueEquipo(ej, sem)}
    <section class="series">${ses.series.map((s, k) => `
      <div class="serie ${s.hecha ? 'hecha' : ''} campos-${campos.length}">
        <div class="n num">${k + 1}${ej.extraIzq && k === total - 1 ? '<small>IZQ.</small>' : ''}</div>
        ${campos.map((c) => `<div class="campo"><label for="${c.f}${k}">${c.corto ? '<b>' + esc(c.corto) + '</b>' : ''}${esc(ANOTAR[c.anotar])}</label><input id="${c.f}${k}" inputmode="decimal" data-f="${c.f}" data-k="${k}" value="${esc(s[c.f] ?? '')}" placeholder="0"></div>`).join('')}
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

// ---------------- Barra inferior (fuera de la sesión) ----------------
const TABS = [['hoy', 'Hoy'], ['progreso', 'Progreso'], ['comida', 'Comida'], ['cuenta', 'Cuenta']];
function tabs() { return `<nav class="tabs">${TABS.map(([v, n]) => `<button data-tab="${v}" aria-current="${st.vista === v ? 'page' : 'false'}">${n}</button>`).join('')}</nav>`; }

// ---------------- Gráfico de una serie (SVG, un solo eje) ----------------
function grafico(puntos, { unidad = 'kg', meta = null } = {}) {
  if (puntos.length < 2) return `<p class="vacio">${puntos.length ? `Por ahora 1 registro: <b>${puntos[0].v} ${unidad}</b>. Con dos o más aparece el gráfico.` : 'Todavía no hay registros.'}</p>`;
  const W = 340, H = 170, pl = 34, pr = 14, pt = 14, pb = 26;
  const vs = puntos.map((p) => p.v); let min = Math.min(...vs), max = Math.max(...vs);
  if (meta != null) { min = Math.min(min, meta); max = Math.max(max, meta); }
  if (max - min < 1) { max += 1; min -= 1; }
  const pad = (max - min) * 0.12; min -= pad; max += pad;
  const x = (i) => pl + (i * (W - pl - pr)) / (puntos.length - 1);
  const y = (v) => pt + ((max - v) * (H - pt - pb)) / (max - min);
  const ticks = [min + pad, (min + max) / 2, max - pad].map((v) => Math.round(v * 10) / 10);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ult = puntos[puntos.length - 1];
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución: de ${puntos[0].v} a ${ult.v} ${unidad}">
    ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" class="g-grid"/><text x="${pl - 6}" y="${y(t) + 4}" class="g-eje" text-anchor="end">${t}</text>`).join('')}
    ${meta != null ? `<line x1="${pl}" x2="${W - pr}" y1="${y(meta)}" y2="${y(meta)}" class="g-meta"/>` : ''}
    <path d="${linea}" class="g-linea"/>
    ${puntos.map((p, i) => `<g class="g-pt" tabindex="0"><circle cx="${x(i)}" cy="${y(p.v)}" r="14" class="g-hit"/><circle cx="${x(i)}" cy="${y(p.v)}" r="${i === puntos.length - 1 ? 5 : 4}" class="g-punto"/><title>${esc(p.f)}: ${p.v} ${unidad}</title></g>`).join('')}
    <text x="${pl}" y="${H - 6}" class="g-eje">${esc(fechaCorta(puntos[0].f))}</text><text x="${W - pr}" y="${H - 6}" class="g-eje" text-anchor="end">${esc(fechaCorta(ult.f))}</text>
  </svg>`;
}
const fechaCorta = (iso) => { const [, m, d] = String(iso).split('-'); return `${+d}/${+m}`; };

// ---------------- PROGRESO ----------------
function pesosSemana() { return leer('gym.peso', []); } // [{ fecha, kg }]
function avisoPeso() {
  const p = pesosSemana(); if (p.length < 2) return '';
  const a = p[p.length - 2], b = p[p.length - 1];
  const dias = Math.max(1, (new Date(b.fecha) - new Date(a.fecha)) / 864e5);
  const porSemana = ((b.kg - a.kg) / dias) * 7;
  const [lo, hi] = plan.pesoCorporal.subidaSemanal;
  if (porSemana > hi) return `<div class="aviso">${esc(plan.pesoCorporal.aviso)} (+${porSemana.toFixed(2)} kg por semana)</div>`;
  if (porSemana < lo) return `<p class="nota">Vas ${porSemana >= 0 ? '+' : ''}${porSemana.toFixed(2)} kg por semana. La meta es subir entre ${lo} y ${hi} kg: si no sube, sumá comida.</p>`;
  return `<p class="nota ok">Vas +${porSemana.toFixed(2)} kg por semana: justo en la meta (${lo}–${hi}).</p>`;
}
function renderProgreso() {
  pararMunecos();
  const s = sesiones(), r = racha(), reg = registros();
  const ids = todos().filter((e) => (reg[e.id] || []).length).map((e) => e.id);
  if (!st.ejProg || !ids.includes(st.ejProg)) st.ejProg = ids[0] || null;
  const serie = st.ejProg ? (reg[st.ejProg] || []).map((x) => ({ f: x.fecha, v: Math.max(0, ...x.series.filter((y) => y.hecha).map((y) => +y.kg || 0)) })).filter((p) => p.v > 0) : [];
  const pesos = pesosSemana().map((p) => ({ f: p.fecha, v: p.kg }));
  const mol = leer('gym.molestias', []);
  $('#app').innerHTML = `
  <header class="top"><span class="eyebrow">Progreso</span><h1>Cómo venís</h1></header>
  <main class="wrap">
    <div class="tiles"><div class="card tile"><b class="num">${s.length}</b><span>entrenamientos</span></div><div class="card tile"><b class="num">${r}</b><span>semanas seguidas</span></div><div class="card tile"><b class="num">${st.semana}</b><span>semana del plan</span></div></div>
    <section class="card">
      <div class="ej-n">PESO CORPORAL</div>
      <form class="peso-form" data-form="peso"><input id="pesoKg" inputmode="decimal" placeholder="${esc(String((pesos[pesos.length - 1] || {}).v ?? plan.pesoCorporal.inicial))}" aria-label="Peso de hoy en kilos"><button class="btn prim" type="submit">Anotar kg</button></form>
      ${grafico(pesos, { unidad: 'kg' })}
      ${avisoPeso()}
      <p class="nota">Pesate una vez por semana, el mismo día, en ayunas.</p>
    </section>
    <section class="card">
      <div class="ej-n">PESO POR EJERCICIO (MÁXIMO DE CADA SESIÓN)</div>
      ${ids.length ? `<select id="ejProg" class="sel" aria-label="Ejercicio">${ids.map((id) => `<option value="${esc(id)}" ${id === st.ejProg ? 'selected' : ''}>${esc(ejercicio(id).nombre)}</option>`).join('')}</select>${grafico(serie, { unidad: 'kg' })}` : '<p class="vacio">Cuando anotes kilos en tus series, acá vas a ver cómo suben.</p>'}
    </section>
    <section class="card">
      <div class="ej-n">MOLESTIAS ANOTADAS</div>
      ${mol.length ? `<ul class="mol">${mol.slice().reverse().map((m) => `<li><b>${esc(m.zona)}</b> · ${esc(m.ejercicio)} <span>${esc(fechaCorta(m.fecha))}</span></li>`).join('')}</ul><p class="nota">Consultalas con tu kinesióloga antes de volver a esos ejercicios.</p>` : '<p class="vacio">Sin molestias anotadas. 💪</p>'}
    </section>
  </main>${tabs()}`;
}

// ---------------- COMIDA ----------------
function renderComida() {
  pararMunecos();
  const c = plan.comida, hoy = hoyISO(), reg = leer('gym.proteina', {});
  const lista = reg[hoy] || [], total = lista.reduce((a, b) => a + b, 0), pct = Math.min(100, Math.round((total / c.proteinaDia) * 100));
  const porComida = Math.round(c.proteinaDia / c.comidas);
  $('#app').innerHTML = `
  <header class="top"><span class="eyebrow">Comida · ${esc(hoyFecha())}</span><h1>Proteína de hoy</h1><div class="sub">Meta: ${c.proteinaDia} g en ${c.comidas} comidas (unos ${porComida} g cada una)</div></header>
  <main class="wrap">
    <section class="card prot">
      <div class="prot-num"><b class="num">${total}</b><span>de ${c.proteinaDia} g</span></div>
      <div class="prot-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${c.proteinaDia}" aria-valuenow="${total}"><i style="width:${pct}%"></i></div>
      <p class="nota">${total >= c.proteinaDia ? '¡Meta cumplida! 🎯' : `Te faltan ${c.proteinaDia - total} g.`}</p>
    </section>
    <div class="prot-btns">${c.botones.map((g) => `<button class="btn prim grande" data-act="prot" data-g="${g}">+${g} g</button>`).join('')}</div>
    <button class="btn" style="width:100%;margin-top:8px" data-act="protDeshacer" ${lista.length ? '' : 'disabled'}>Deshacer el último</button>
    <section class="card" style="margin-top:12px"><div class="ej-n">REFERENCIA RÁPIDA</div>
      <ul class="ref"><li>3 huevos ≈ 20 g</li><li>150 g de pollo o carne ≈ 40 g</li><li>1 scoop de proteína ≈ 25 g</li><li>200 g de yogur griego o queso untable descremado ≈ 20 g</li><li>1 lata de atún ≈ 25 g</li></ul>
    </section>
  </main>${tabs()}`;
}

// ---------------- CUENTA ----------------
function renderCuenta() {
  pararMunecos();
  const cinco = plan.cincoDias;
  $('#app').innerHTML = `
  <header class="top"><span class="eyebrow">Cuenta</span><h1>Tus datos</h1><div class="sub">${esc(nube.txt)}</div></header>
  <main class="wrap">
    <section class="card">
      ${conectado() ? `<p style="margin:0 0 10px">Conectado como <b>${esc(mailActual())}</b>. Todo lo que anotás se guarda en tu Firebase: si cambiás de celu, entrá con la misma cuenta y aparece todo.</p><button class="btn" style="width:100%" data-act="salirCuenta">Cerrar sesión</button>`
        : `<p style="margin:0 0 10px">Entrá con tu cuenta (la misma de la app de clases) para guardar todo en la nube.</p>
        <form data-form="login" class="login"><label for="lMail">Mail</label><input id="lMail" type="email" autocomplete="username" value="gabohuppi22@gmail.com"><label for="lClave">Contraseña</label><input id="lClave" type="password" autocomplete="current-password"><button class="btn prim grande" type="submit">Entrar</button></form>`}
    </section>
    <section class="card"><div class="ej-n">PLAN</div><p style="margin:6px 0 0">${esc(plan.nombre)} · ${plan.semanas} semanas · ${plan.diasPorSemana} días (${esc(plan.diasSugeridos.join(', '))}) · versión ${esc(plan.version)}</p>
      ${cinco ? `<p class="nota">Plan de 5 días: ${cinco.activo ? 'activo' : 'preparado para más adelante'} (${cinco.dias.map((d) => esc(d.dia + ': ' + d.foco)).join(' · ')}).</p>` : ''}</section>
  </main>${tabs()}`;
}

function render() {
  if (st.vista === 'hoy') return renderHoy();
  if (st.vista === 'progreso') return renderProgreso();
  if (st.vista === 'comida') return renderComida();
  if (st.vista === 'cuenta') return renderCuenta();
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
  const m = modoDe(ejercicio(id));
  const reg = { fecha: hoyISO(), semana: st.semana, dia: st.dia, ...(m ? { modo: m.id } : {}), series: ses.series.map((s) => ({ kg: s.kg, ...(s.kg2 !== undefined && s.kg2 !== '' ? { kg2: s.kg2 } : {}), reps: s.reps, hecha: s.hecha })) };
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
document.addEventListener('change', (e) => {
  if (e.target.id === 'torneo') { st.torneo = e.target.checked; render(); }
  if (e.target.id === 'ejProg') { st.ejProg = e.target.value; render(); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.dataset.form; if (!f) return;
  e.preventDefault();
  if (f === 'peso') {
    const kg = parseFloat(($('#pesoKg').value || '').replace(',', '.'));
    if (!(kg > 30 && kg < 250)) { toast('Poné tu peso en kilos, por ejemplo 85,4'); return; }
    const p = pesosSemana(); const hoy = hoyISO();
    if (p.length && p[p.length - 1].fecha === hoy) p[p.length - 1].kg = kg; else p.push({ fecha: hoy, kg });
    guardar('gym.peso', p); render(); toast('Peso anotado');
  }
  if (f === 'login') {
    const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Entrando…';
    try { await entrar($('#lMail').value, $('#lClave').value); toast('¡Listo! Ya guarda en la nube'); }
    catch (err) { toast(err && err.code === 'auth/invalid-credential' ? 'Mail o contraseña incorrectos' : 'No se pudo entrar. Revisá la conexión.'); btn.disabled = false; btn.textContent = 'Entrar'; }
  }
});
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { st.vista = t.dataset.tab; render(); scrollTo(0, 0); return; }
  const b = e.target.closest('[data-act],[data-sem],[data-dia]'); if (!b) return;
  if (b.dataset.act === 'prot') { const r = leer('gym.proteina', {}); (r[hoyISO()] ||= []).push(+b.dataset.g); guardar('gym.proteina', r); render(); return; }
  if (b.dataset.act === 'protDeshacer') { const r = leer('gym.proteina', {}); (r[hoyISO()] || []).pop(); guardar('gym.proteina', r); render(); return; }
  if (b.dataset.act === 'salirCuenta') { salir().then(render); return; }
  if (b.dataset.act === 'modo') { const m = leer('gym.modos', {}); m[b.dataset.id] = b.dataset.v; guardar('gym.modos', m); render(); return; }
  if (b.dataset.sem) { st.semana = +b.dataset.sem; guardar('gym.semana', st.semana); render(); return; }
  if (b.dataset.dia) { st.dia = b.dataset.dia; render(); return; }
  const a = b.dataset.act;
  if (a === 'empezar') { st.dia = b.dataset.d; st.pasos = armarPasos(st.dia); st.i = 0; st.sesion = {}; st.cal = {}; st.calAbierto = null; st.vista = 'sesion'; render(); scrollTo(0, 0); return; }
  if (a === 'salir') { Object.keys(st.sesion).forEach(guardarEj); cerrarCrono(); st.vista = 'hoy'; render(); scrollTo(0, 0); return; }
  if (a === 'calor') { st.cal[b.dataset.id] = !st.cal[b.dataset.id]; render(); return; }
  if (a === 'calAbrir') { st.calAbierto = b.dataset.id; render(); scrollTo(0, 0); return; }
  if (a === 'calLista') { st.calAbierto = null; render(); scrollTo(0, 0); return; }
  if (a === 'calHecho' || a === 'calSig') {
    const items = plan.calentamiento.items, k = items.findIndex((c) => c.id === st.calAbierto);
    if (a === 'calHecho') { const id = st.calAbierto; st.cal[id] = !st.cal[id]; if (!st.cal[id]) { render(); return; } }
    // Al tachar: abre el siguiente que falte (o vuelve a la lista si están todos). «Siguiente»: el que sigue en orden.
    const sig = a === 'calSig' ? items[k + 1] : [...items.slice(k + 1), ...items.slice(0, k)].find((c) => !st.cal[c.id]);
    if (!sig && a === 'calSig') { st.calAbierto = null; st.i++; render(); scrollTo(0, 0); return; }
    st.calAbierto = sig ? sig.id : null; render(); scrollTo(0, 0); return;
  }
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
  DIAS = plan.orden || Object.keys(plan.dias);
  render();
  // Nube: al conectar o bajar datos, se redibuja (salvo en plena sesión, para no perder lo que estás anotando).
  iniciarNube((bajo) => { if (st.vista === 'cuenta' || (bajo && st.vista !== 'sesion')) { if (bajo) st.semana = leer('gym.semana', st.semana); render(); } });
})();
