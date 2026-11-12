# Plan de gimnasio

App para entrenar desde el iPhone: https://masterpadel360.github.io/plan-gimnasio/
(Safari → compartir → «Agregar a pantalla de inicio»).

**El plan vive en `plan.json`, separado del código.** Para cambiar el entrenamiento se edita solo ese archivo: la app lo vuelve a leer cada vez que se abre (sin caché).

## Reglas de oro para editar `plan.json`

1. **El `id` de un ejercicio no se cambia nunca.** Los kilos y repeticiones se guardan por ese id (en Firebase). Si cambiás el nombre, el historial sigue; si cambiás el id, se pierde.
2. Para un ejercicio nuevo, inventá un id nuevo en minúsculas y con guiones (`press-arnold`).
3. Después de editar, revisá que el JSON sea válido (comas, llaves y comillas).
4. Subí `version` (por ejemplo `"2026-12-01a"`) para saber qué plan tiene cargado la app (se ve en Cuenta).

## Estructura

```jsonc
{
  "version": "2026-11-12a",
  "nombre": "…", "semanas": 12, "diasPorSemana": 3, "diasSugeridos": ["lunes", "miércoles", "viernes"],
  "etapas": [ { "id": 1, "nombre": "Adaptación", "semanas": [1, 4], "tanque": "…", "saltos": "…" }, … ],
  "descarga": { "semanas": [4, 8, 12], "regla": "Una serie menos (mínimo 2)" },
  "progresion": { "piernas": [2.5, 5], "torso": [1, 2], "torsoPor": "mancuerna" },
  "calentamiento": { "minutos": 12, "items": [ { "id": "cal-bici", "nombre": "…", "dosis": "5 min" } ] },
  "dias": { "A": { "nombre": "…", "ejercicios": [ … ] }, "B": { … }, "C": { … } },
  "orden": ["A", "B", "C"],            // opcional: orden de los días (si falta, el de "dias")
  "extras": [ … ],                     // ejercicios que solo se usan dentro de una superserie
  "cincoDias": { "activo": false, "dias": [ … ] },
  "comida": { "proteinaDia": 170, "comidas": 4, "botones": [20, 30, 40] },
  "pesoCorporal": { "inicial": 85, "subidaSemanal": [0.25, 0.5], "aviso": "…" },
  "molestias": ["codo", "zona lumbar", "rodilla", "otro"]
}
```

### Un ejercicio

```jsonc
{
  "id": "sentadilla-bulgara",              // fijo para siempre
  "nombre": "Sentadilla búlgara",
  "nombreEtapa": ["Goblet", "Con barra", "Con barra"],   // opcional: nombre distinto por etapa
  "grupo": "piernas",                      // piernas | torso | core (define cuánto sugiere subir)
  "series": ["3×8", "3×10", "3×8"],        // una por etapa: semanas 1–4, 5–8, 9–12. "3×30 s" = tiempo. "–" = no se hace
  "nota": ["", "", "Más peso"],            // opcional, una por etapa
  "por": "por pierna",                     // opcional
  "extraIzq": true,                        // opcional: suma una serie con la izquierda
  "desdeSemana": 3,                        // opcional
  "descanso": 90,                          // segundos
  "superserie": ["id-1", "id-2"],          // opcional: muestra los dos muñecos (los ids van en "dias" o en "extras")
  "equipo": {                              // bloque «Con qué lo hago». Cada campo puede ser un texto o una lista de 3 (una por etapa)
    "elemento": "Mancuernas", "peso": "Una en cada mano.", "progresar": "1 o 2 kg más.",
    "anotar": "por-mancuerna",             // total | por-mancuerna | mancuerna | placa | discos | agregado | asistencia | pelota | ninguno (sin campo de kg)
    "opciones": [ { "id": "maquina", "nombre": "Máquina", "peso": "…", "anotar": "placa" } ]  // opcional: el alumno elige y se recuerda (gym.modos)
  },
  "pasos": ["…"], "errores": ["…"], "porque": "…",
  "video": { "url": "https://www.youtube.com/watch?v=…", "canal": "…", "titulo": "…" },  // null = abre la búsqueda de YouTube
  "anim": { … }                            // el muñeco (abajo)
}
```

Semanas de descarga (4, 8 y 12): la app resta una serie sola (mínimo 2).

## El muñeco (`anim`)

Un solo muñeco para todo. Cada ejercicio es una lista de **posiciones clave** (`poses`) y la app interpola entre ellas en loop.

```jsonc
"anim": {
  "vista": "lado",            // "lado" (de costado, mira hacia la derecha) o "frente"
  "cerca": "I",               // en vista de costado, qué lado se ve adelante (I o D)
  "encuadre": "-110 -215 220 225",   // opcional, si el muñeco se sale de cuadro (más alto)
  "equipo": [ … ],            // elementos (abajo)
  "trabaja": [ … ],           // músculos marcados en naranja
  "guias": [ … ],             // líneas azules de referencia
  "poses": [
    { "fase": "Bajá en 3 s", "dur": 3, "pelvis": [-4, 82], "tronco": 8, … },
    { "fase": "Subí fuerte", "pausa": 0.4, "dur": 1, "pelvis": [-10, 50], … }
  ]
}
```

**Coordenadas:** en «cm de muñeco». `x` hacia adelante (de frente: hacia la derecha), `y` hacia arriba, el piso es `y = 0`. Medidas: tronco 50, brazo 28, antebrazo 26, muslo 44, pierna 42. Parado, la pelvis está en `[0, 88]`.

**Tiempo (el ritmo real):** cada pose tiene `dur` = segundos que tarda en ir a la siguiente, y `pausa` = segundos quieto antes de arrancar. Si la bajada es de 3 s, la pose de arriba lleva `"dur": 3`. `fase` es el texto grande que se ve mientras tanto.

**Campos de una pose** (todos opcionales):

| Campo | Qué es |
|---|---|
| `pelvis` | `[x, y]` |
| `tronco` | grados: 0 = derecho; + inclinado hacia adelante; −90 = acostado boca arriba con la cabeza atrás; 90 = boca abajo |
| `cabeza` | grados extra respecto del tronco |
| `pieI`, `pieD` | `[x, y]` del tobillo. La rodilla se calcula sola |
| `rodillaI`, `rodillaD` | hacia dónde dobla: `1` adelante, `-1` atrás, `"arriba"`, `"abajo"` |
| `pieAngI`, `pieAngD` | ángulo del pie: 0 = plano hacia adelante, −40 = en puntas, 180 = hacia atrás |
| `brazoI`, `brazoD` | `[hombro, codo]` en grados desde «colgando» (0); + hacia adelante (de frente: hacia la derecha); 180 = arriba |
| `manoI`, `manoD` | `[x, y]` de la mano (en vez de `brazo`); el codo se calcula solo con `codoI` / `codoD` (`1`, `-1`, `"arriba"`, `"abajo"`) |
| `munecaI`, `munecaD` | ángulo de la mano (para ejercicios de muñeca) |

**Equipo:**
- `{ "tipo": "banco", "x": -64, "alto": 42, "ancho": 36 }` (también `"cajon"`)
- `{ "tipo": "mancuerna" }` (en las dos manos; `"manos": ["manoD"]` o `["manos"]` para una sola al medio, `["punoI"]` si hay muñeca)
- `{ "tipo": "barra" }` (sigue el punto medio de las manos)
- `{ "tipo": "polea", "x": 56, "alto": 188, "mano": "manoI", "desde": [x, y] }`
- `{ "tipo": "poligono", "puntos": [[x, y], …], "oscuro": true }` (cualquier forma fija: máquina, banco inclinado, paralelas)
- `{ "tipo": "placa", "en": "pieI", "ang": 45, "largo": 46 }` (pieza que sigue una articulación: plataforma, almohadilla)
- `{ "tipo": "pelota", "en": "manos", "r": 11 }`

**Músculos (`trabaja`):** segmentos `musloI`, `piernaI`, `brazoI`, `antebrazoI`, `tronco` (y los D), con `"lado": "frente"` o `"atras"` para marcar cuádriceps/isquios o bíceps/tríceps; o especiales: `gluteoI`, `hombroI`, `pecho`, `espalda`, `abdomen`.

**Guías (`guias`):**
- `{ "tipo": "vertical", "desde": "puntaI", "largo": 58, "texto": "rodilla sobre el pie" }`
- `{ "tipo": "horizontal", "en": "cuello", "largo": 82, "texto": "altura del hombro" }`
- `{ "tipo": "segmento", "seg": "tronco", "texto": "espalda recta" }`
- `{ "tipo": "linea", "de": "pieI", "a": "cuello", "texto": "línea recta" }`

Puntos que se pueden usar: `pelvis`, `cuello`, `cabeza`, `hombroI/D`, `codoI/D`, `manoI/D`, `manos`, `punoI/D`, `caderaI/D`, `rodillaI/D`, `pieI/D`, `puntaI/D`.

Consejo: copiá el `anim` de un ejercicio parecido y ajustá números de a poco.

## Pasar a 5 días

Agregá los días en `"dias"` (por ejemplo `"Lun"`, `"Mar"`, …, cada uno con sus ejercicios), poné `"orden": ["Lun", "Mar", "Mie", "Jue", "Vie"]`, cambiá `"diasPorSemana": 5` y `"cincoDias.activo": true`. Los ids que ya existen conservan su historial.

## Datos

- Se guardan en el celu y, con la sesión iniciada (pestaña Cuenta), en Firebase: `gestion/gimnasio` (sesiones, semana, peso, comida, molestias) y `gestion/gimnasio-registros` (kilos y repeticiones por id de ejercicio). Solo la cuenta dueña puede leerlos.
- Cambio de celu: abrís la app, Cuenta → entrás con tu mail y contraseña, y se baja todo.

## Archivos

- `plan.json`: el plan. `js/muneco.js`: el muñeco. `js/app.js`: pantallas. `js/nube.js`: Firebase. `css/app.css`: estilo.
- `sh version.sh`: sube la versión de los archivos de código para que el iPhone baje la app nueva (para `plan.json` no hace falta).
