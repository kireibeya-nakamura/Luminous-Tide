# Claude / Collaborator Brief

## Project

Working title: **Luminous Tide / Glow Tide / Effort Tide**

This is a browser-based interaction prototype for an app that visualizes long-term effort as a luminous, bioluminescent water surface.

The user is focused on CG direction, interaction design, and visual atmosphere. Implementation should stay beginner-friendly and easy to modify.

## Core Concept

Effort is invisible, but it accumulates.

When the user records daily effort, water slowly fills, light increases, and particle density grows. The surface should feel like a quiet night sea with glowing plankton.

## Current Prototype

The current version is dependency-free:

- Plain HTML
- CSS
- JavaScript Canvas
- `localStorage` for persistence

No build tools are required.

Open `index.html` directly in a browser.

## Current Features

- Add effort minutes by category
- Store records in `localStorage`
- Show today, total, and streak values
- Increase water scale, glow, and particle density based on effort
- Pointer hover attracts glow
- Pointer drag creates flow trails
- Click / tap creates ripples and luminous particles
- Device orientation support is available through the tilt button

## Important Files

- `index.html`: UI and page structure
- `styles.css`: layout and visual styling
- `app.js`: simulation, particles, records, interaction
- `serve-static.ps1`: optional local server for phone testing

## Design Direction

Prefer:

- Dark night-sea atmosphere
- Cyan, blue, violet, and soft green emission
- Quiet, elegant interactions
- Stronger reward on click / tap, but not constantly noisy
- A feeling of accumulated effort becoming visible

Avoid:

- Busy dashboard UI
- Bright productivity-app colors
- Loud gamification
- Heavy dependencies before the interaction concept is stable

## Suggested Next Steps

1. Improve mobile layout and touch feel
2. Add calendar-style daily history
3. Add richer record categories and color mixing
4. Add export/import of records
5. Convert the water rendering to Three.js or Unreal Engine after the concept feels right

## Collaboration Notes

This prototype is intentionally small. If editing, keep it easy to open in a browser without installing packages unless the project is intentionally moving to a framework.
