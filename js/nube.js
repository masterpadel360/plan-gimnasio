// Guardado en la nube (Firebase de Gabriel). Todo se guarda primero en el celu (funciona sin internet) y se copia a Firestore.
// Documentos: gestion/gimnasio (sesiones, semana, peso, comida, molestias) y gestion/gimnasio-registros (pesos por id de ejercicio).
// Si cambiás de celu: entrás con tu mail y contraseña y se baja todo.

const CLAVES_DATOS = ['gym.semana', 'gym.sesiones', 'gym.molestias', 'gym.peso', 'gym.proteina'];
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin espacio */ } };

let db = null, auth = null, usuario = null, timer = 0, avisar = () => {};
export const estado = { txt: 'Sin conectar', ok: false };

function set(txt, ok) { estado.txt = txt; estado.ok = ok; avisar(); }

export function iniciarNube(alCambiar) {
  avisar = alCambiar || avisar;
  if (!window.firebase || !window.FIREBASE_CONFIG) { set('Sin conexión con la nube', false); return; }
  try {
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = app.auth(); db = app.firestore();
  } catch { set('No se pudo iniciar la nube', false); return; }
  auth.onAuthStateChanged(async (u) => {
    usuario = u;
    if (!u) { set('Entrá con tu cuenta para guardar en la nube', false); return; }
    set('Sincronizando…', false);
    await bajar();
  });
}

export async function entrar(mail, clave) {
  if (!auth) throw new Error('La nube no está disponible');
  await auth.signInWithEmailAndPassword(mail.trim(), clave);
}
export async function salir() { if (auth) await auth.signOut(); }
export const conectado = () => !!usuario;
export const mailActual = () => (usuario && usuario.email) || '';

// Cada cambio local marca la hora y programa una subida.
export function marcarCambio() {
  escribir('gym.actualizado', Date.now());
  clearTimeout(timer); timer = setTimeout(subir, 1500);
}

async function subir() {
  if (!db || !usuario) return;
  const t = leer('gym.actualizado', Date.now());
  const datos = { actualizado: t };
  for (const k of CLAVES_DATOS) datos[k.slice(4)] = leer(k, null);
  try {
    await db.doc('gestion/gimnasio').set(datos);
    await db.doc('gestion/gimnasio-registros').set({ actualizado: t, registros: leer('gym.registros', {}) });
    set('Guardado en la nube ✓', true);
  } catch (e) {
    set(e && e.code === 'permission-denied' ? 'Esta cuenta no tiene permiso para guardar' : 'Sin internet: se guarda al volver la conexión', false);
  }
}

async function bajar() {
  try {
    const [d, r] = await Promise.all([db.doc('gestion/gimnasio').get(), db.doc('gestion/gimnasio-registros').get()]);
    const local = leer('gym.actualizado', 0);
    const nube = d.exists ? (d.data().actualizado || 0) : 0;
    if (nube > local) {
      const x = d.data();
      for (const k of CLAVES_DATOS) if (x[k.slice(4)] != null) escribir(k, x[k.slice(4)]);
      if (r.exists) escribir('gym.registros', r.data().registros || {});
      escribir('gym.actualizado', nube);
      set('Datos bajados de la nube ✓', true);
      avisar(true);
    } else if (local > nube) {
      await subir();
    } else set('Guardado en la nube ✓', true);
  } catch (e) {
    set(e && e.code === 'permission-denied' ? 'Esta cuenta no tiene permiso para guardar' : 'Sin internet: se guarda al volver la conexión', false);
  }
}
