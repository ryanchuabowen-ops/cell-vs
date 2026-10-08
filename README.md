# Cell vs.

A free, browser-based 2D top-down immune-system arena brawler. No build step, no backend, no accounts -- pure HTML/CSS/JS, deployable straight to GitHub Pages.

Play as one of **6 characters** (3 Immune Cells, 3 Pathogens) in **PvBot** (10v10 vs AI), or lead a horde of 20 AI allies as any character -- including a Bacteriophage or Virophage hero -- in **PvE**.

## Characters

| Character | Side | Primary (RMB) | Secondary (LMB) |
|---|---|---|---|
| Macrophage | Immune | Engulf Surge -- grows larger/faster for 4s, devours enemies on touch | Phagocytose -- attach-range bite (must make contact) |
| Neutrophil | Immune | NETosis -- sticky nets that slow + damage | Toxin Spray -- rapid-fire darts |
| Plasma / B-Cell | Immune | Antibody Barrage -- fires in all directions | IgG Shotgun -- forward spread |
| Anthrax / E.coli | Pathogen | Lethal Toxin -- single shot, instant-kill blast, very long recharge | Edema Toxin -- standard shot |
| Coronavirus | Pathogen | Viral Clone -- homing clone that instantly kills on contact | Spike Burst -- area-damage shot |
| Strep A | Pathogen | SpeB Trail -- leaves a damaging/slowing trail as it moves | Streptolysin Shot -- standard shot |
| Bacteriophage (PvE) | Phage | Lyse -- attach-range instant kill | Phage Burst -- fast 3-round spread |
| Virophage (PvE) | Phage | Genome Injection -- homing instant-kill shot, no contact needed | Capsid Burst -- fast 3-round spread |

"Attach" abilities (Phagocytose, Lyse) only land while the two cells are actually touching -- closing the distance is part of playing them.

## Controls

- **Move:** WASD or Arrow Keys
- **Aim:** your cell always faces the mouse cursor
- **Right-click:** Primary power
- **Left-click:** Secondary power

## Modes

- **PvBot -- 10v10:** pick any of the 6 characters (either side) and fight alongside 9 AI teammates against 10 AI pathogens. The map has three capturable flags plus each team's home base; hold flags to tick up score over time, or rack up kills -- first to 60 points wins, or whoever leads when the clock hits zero. Bots fighting each other far from you simmer down instead of resolving the match on their own -- getting involved is what actually moves the score.
- **PvE Horde:** pick any character -- an Immune cell defends with 20 AI allies against 8 escalating waves of pathogens; a Pathogen instead leads 20 AI allies against waves of immune cells; a Bacteriophage/Virophage hero fights alongside the immune side. Allies respawn freely; your own hero has a shared pool of 5 lives. When your hero dies, you can respawn as a different character on the same side.

Both modes take place on a random biological location each match (blood vessel, intestinal lining, alveolar lung tissue, or lymph node), each with its own themed terrain. The map also has a few slowly drifting obstacles that block movement and sight, and a handful of health / instant-recharge pickups scattered around.

Walls (and the drifting obstacles) block line of sight -- a shadow-casting fog of war hides anything outside your cell's view.

## Running locally

No build tools needed -- just serve the folder statically, e.g.:

```bash
npx serve .
```

or open `index.html` directly in a modern browser (Chrome/Edge/Firefox).

## Deploying to GitHub Pages (free)

1. Create a new GitHub repository (public or private).
2. Push the contents of this folder to the `main` branch.
3. In the repo, go to **Settings → Pages**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
4. Your game will be live at `https://<your-username>.github.io/<repo-name>/`.

If you don't have Git installed, you can also drag-and-drop these files into a new repository directly on github.com (Add file → Upload files), or use GitHub Desktop.

## Project structure

```
index.html          Menu, mode select, character select, and game screens
css/style.css        All styling
js/map.js            World/wall layout, collision, shadow-casting fog of war, drifting obstacles
js/characters.js      The 6 characters + Bacteriophage/Virophage, their stats and abilities
js/shapes.js          Biologically-styled canvas silhouettes for each character
js/entities.js        Units, projectiles, hazards (nets/trails), ability logic
js/ai.js              Bot AI -- target priority, flag-seeking, retreat-when-low, player-dependent intensity
js/game.js            Game loop, simulation, flags/timer/pickups, rendering, mode setup
js/main.js            Menu/mode-select/character-select/HUD/respawn-picker DOM wiring
```
