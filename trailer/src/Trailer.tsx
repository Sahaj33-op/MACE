import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { Intro } from './components/Intro';
import { SlideInstances } from './components/SlideInstances';
import { SlideLoaders } from './components/SlideLoaders';
import { SlideCrash } from './components/SlideCrash';
import { SlideContent } from './components/SlideContent';
import { Outro } from './components/Outro';
import './style.css';

export const Trailer: React.FC = () => {
  return (
    <div style={{ flex: 1, backgroundColor: '#020617' }}>
      {/* Intro Scene (0s - 5s / 150 frames) */}
      <Sequence from={0} durationInFrames={150}>
        <Intro />
      </Sequence>
      {/* Slide 1: Isolated Instances (5s - 11s / 180 frames) */}
      <Sequence from={150} durationInFrames={180}>
        <SlideInstances />
      </Sequence>
      {/* Slide 2: Loaders (11s - 17s / 180 frames) */}
      <Sequence from={330} durationInFrames={180}>
        <SlideLoaders />
      </Sequence>
      {/* Slide 3: Crash Watchdog (17s - 23s / 180 frames) */}
      <Sequence from={510} durationInFrames={180}>
        <SlideCrash />
      </Sequence>
      {/* Slide 4: Content Manager (23s - 27s / 120 frames) */}
      <Sequence from={690} durationInFrames={120}>
        <SlideContent />
      </Sequence>
      {/* Outro Scene (27s - 30s / 90 frames) */}
      <Sequence from={810} durationInFrames={90}>
        <Outro />
      </Sequence>
    </div>
  );
};
