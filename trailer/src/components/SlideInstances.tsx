import React from 'react';
import { useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { FeatureSlide } from './FeatureSlide';
import { SimulatedPointer } from './SimulatedPointer';
import { getCursorState, MotionKeyframe } from '../utils/motion';

export const SlideInstances: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Define pointer movement path keyframes
  const path: MotionKeyframe[] = [
    { frame: 0, x: 90, y: 90 }, // Start off bottom-right
    { frame: 35, x: 38, y: 32 }, // Move to the first Server Instance Card
    { frame: 40, x: 38, y: 32, click: true }, // Click the Server Card
    { frame: 75, x: 86, y: 18 }, // Move to "Start Server" action button
    { frame: 80, x: 86, y: 18, click: true }, // Click "Start Server"
    { frame: 120, x: 12, y: 45 }, // Move back to sidebar navigation
    { frame: 125, x: 12, y: 45, click: true }, // Click navigation item
    { frame: 180, x: -10, y: 50 }, // Exit left
  ];

  const cursor = getCursorState(frame, path, fps);

  // Simulated UI responses based on frame count
  const isCardSelected = frame >= 40;
  const isServerRunning = frame >= 80;

  return (
    <FeatureSlide
      badge="01 / INSTANCE MANAGEMENT"
      title="Isolated Minecraft Servers"
      description="Create, import, and manage multiple server instances under isolated environments. One click starts, stops, or configures your server instantly."
      windowTitle="Mace - Dashboard Overview"
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Background base screenshot */}
        <img
          src={staticFile('Screenshots/Screenshot 2026-01-01 064218.png')}
          alt="Dashboard Screenshot"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Dynamic Highlight Overlays */}
        {/* Server Card Selection Outline */}
        {isCardSelected && (
          <div
            style={{
              position: 'absolute',
              left: '23%',
              top: '21%',
              width: '30%',
              height: '22%',
              border: '2.5px solid var(--primary)',
              borderRadius: '8px',
              pointerEvents: 'none',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.15s ease-out',
            }}
          />
        )}

        {/* Server Running Status Badge Glow Overlay */}
        {isServerRunning && (
          <div
            style={{
              position: 'absolute',
              left: '42%',
              top: '24%',
              width: '75px',
              height: '24px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1.5px solid var(--primary)',
              borderRadius: '4px',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            <span
              style={{
                color: 'var(--primary)',
                fontSize: '11px',
                fontWeight: 'bold',
                fontFamily: 'sans-serif',
                letterSpacing: '0.5px',
              }}
            >
              RUNNING
            </span>
          </div>
        )}

        {/* Click pointer overlay */}
        <SimulatedPointer
          x={cursor.x}
          y={cursor.y}
          clickProgress={cursor.clickProgress}
          lastClickFrame={cursor.lastClickFrame}
          currentFrame={frame}
        />
      </div>
    </FeatureSlide>
  );
};
