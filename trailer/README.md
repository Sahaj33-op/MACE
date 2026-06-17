# Mace Video Trailer (Remotion)

This directory contains the **Remotion** project to build a high-quality, 30-second animated video trailer for **Mace** (the Minecraft Server Instance Manager).

It leverages standard React, CSS, and spring physics animations. It simulates user interactions (like cursor movement, clicking buttons, accepting EULAs, enabling/disabling switches, and showing loaders) overlaid on top of actual application screenshots.

---

## 🚀 Setup & Installation

To run this video editor locally, you need to install the project dependencies:

```bash
# 1. Navigate to the trailer directory
cd trailer

# 2. Install package dependencies
npm install
```

---

## 📺 Preview the Video (Real-time Editor)

You can preview the video, inspect frame-by-frame animations, and tweak styling in real-time in the browser:

```bash
npm run start
```
This will open the **Remotion Studio** interface at **http://localhost:3000**. Here you can play, pause, seek, and see how the motion graphic clicks align with the screenshots!

---

## 🎬 Render the Video (to MP4)

To render the video into a production-ready `out.mp4` file, run:

```bash
npm run build
```

This uses a headless browser under the hood to render all 900 frames and uses FFmpeg to compile it.

> [!NOTE]
> If you do not have FFmpeg installed on your machine, Remotion will prompt you or you can install it automatically by running:
> `npx remotion install ffmpeg`

---

## 📂 Project Structure

- `src/index.ts`: Remotion bundler entry point.
- `src/Root.tsx`: Composition setup (1080p, 30 FPS, 900 frames).
- `src/Trailer.tsx`: Orchestrates the sequence timeline of scenes.
- `src/style.css`: Visual tokens, layout typography (Outfit & Inter), glassmorphism, and custom animations.
- `src/utils/motion.ts`: Path interpolation and spring click calculators.
- `src/components/`:
  - `Intro.tsx`: Opening sequence with scaling logo and typewriter title.
  - `FeatureSlide.tsx`: General slide layout with left-hand description and right-hand window frame.
  - `SimulatedPointer.tsx`: Standard SVG mouse cursor with custom click ripples.
  - `TerminalStream.tsx` & `TypeWriter.tsx`: Custom text simulation utilities.
  - `SlideInstances.tsx`: Simulates selecting a server card and starting it.
  - `SlideLoaders.tsx`: Simulates selecting Fabric loader and opening dropdowns.
  - `SlideCrash.tsx`: Simulates watchdog terminal output, crash warning, and auto-fix click.
  - `SlideContent.tsx`: Simulates toggling a mod switch and showing downloard progress bars.
  - `Outro.tsx`: Final call-to-action slide with website link.
