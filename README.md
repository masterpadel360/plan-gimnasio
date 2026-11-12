# Plan de gimnasio

App para usar en el iPhone mientras entreno. El plan vive en **`plan.json`** (separado del código): para cambiarlo, se edita solo ese archivo y la app lo lee de nuevo al abrirla.

> Estado: **versión de prueba** del modo entrenamiento con 3 ejercicios animados (sentadilla búlgara, peso muerto rumano y elevaciones laterales). La guía completa del formato de `plan.json` y del muñeco se completa cuando se apruebe el diseño.

- Cada ejercicio tiene un **`id` fijo** que no cambia nunca: los registros de pesos se guardan por ese id.
- `series`: una por etapa (semanas 1–4, 5–8, 9–12), en formato `"3×8–10"`. Las semanas de descarga (4, 8, 12) restan una serie (mínimo 2).
- `anim`: posiciones clave del muñeco (`poses`), con `dur` (segundos hasta la siguiente), `pausa`, `fase` (texto que se muestra), `pelvis [x,y]`, `tronco` (grados), `pieI/pieD [x,y]`, `rodillaI/rodillaD` (1 adelante, -1 atrás, "abajo"), `brazoI/brazoD [hombro, codo]` (grados desde abajo) o `manoI/manoD [x,y]`. Ver `js/muneco.js`.
