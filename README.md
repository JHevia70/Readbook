# Readbook — v1.1

## Novedades
- **Tema**: auto (según sistema), **Oscuro** o **Claro**, con selector manual en el header.
- **Voces por personaje**: ahora respeta **bloques** `[[NOMBRE]]...[[/NOMBRE]]`, **líneas** `NOMBRE: texto` y también **`[voz=NOMBRE] ... [/voz]`** (compatibilidad).
- **Auto-setup**: si usas un personaje que no está en la lista, se **añade solo** y se le asigna una voz distinta del narrador (si hay disponibles).

## Cómo actualizar
1. Sustituye **`app.js`** del repo por el de esta carpeta.
2. Haz commit y push a `main`. GitHub Pages se publicará solo.

Opcional: si quieres el paquete completo, copia también este `README.md`.
