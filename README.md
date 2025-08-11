# Readbook — Voces por personaje (HTML/CSS/JS puros)

App web **100% client-side** (sin backend) que lee en voz alta guiones o libros con la **Web Speech API**. Permite asignar **voces por personaje**, etiquetar por **selección**, por **párrafo** o con **drag & drop**.

## Features
- Web Speech API (Chrome/Edge/Brave desktop recomendado).
- Voz por **Narrador** + voces por **personaje** con ajustes de velocidad/tono/volumen.
- Formatos de guion:
  - Línea: `NOMBRE: diálogo`
  - Bloque: `[[NOMBRE]] ... [[/NOMBRE]]`
- Etiquetado rápido:
  - 🏷️ **Asignar sel.** (a la selección actual)
  - 🧩 **Párrafo** (envuelve el párrafo actual entre saltos en blanco)
  - Chips **drag & drop** sobre el editor.
- Importa `.txt/.md`, exporta `.txt`.
- Autotest DOM para cazar HTML roto.
- Estimación de tiempo y contador de palabras.

## Uso local
1. Descarga este repo y abre `index.html` en tu navegador.
2. Pega/abre tu texto.
3. Define personajes y asigna voces.
4. `▶️ Leer` y listo.

## Atajos
- Espacio: Pausa/Reanuda
- R: Reanudar
- S: Parar

## Despliegue en GitHub Pages
1. Crea un repo y sube todo el contenido.
2. Asegúrate de que la rama es `main`.
3. **Settings → Pages → Source: GitHub Actions** (si no se puso solo).
4. Cada push a `main` publica el sitio. El workflow está en `.github/workflows/pages.yml`.

## Privacidad
Todo se ejecuta en tu navegador. El texto se guarda en `localStorage` para tu comodidad.

---
MIT © 2025 Juan
