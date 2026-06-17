import React from 'react';
import { useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { FeatureSlide } from './FeatureSlide';
import { SimulatedPointer } from './SimulatedPointer';
import { getCursorState, MotionKeyframe } from '../utils/motion';

export const SlideLoaders: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Define pointer movement path keyframes
  const path: MotionKeyframe[] = [
    { frame: 0, x: 10, y: 110 }, // Start off bottom-left
    { frame: 35, x: 42, y: 36 }, // Hover over "Fabric" loader card
    { frame: 40, x: 42, y: 36, click: true }, // Select "Fabric"
    { frame: 75, x: 50, y: 66 }, // Hover over "Java Version" select list
    { frame: 80, x: 50, y: 66, click: true }, // Click dropdown list
    { frame: 120, x: 86, y: 88 }, // Hover over "Create Instance" confirm button
    { frame: 125, x: 86, y: 88, click: true }, // Click Create button
    { frame: 180, x: 110, y: 95 }, // Exit bottom-right
  ];

  const cursor = getCursorState(frame, path, fps);

  // Simulated UI responses based on frame count
  const isFabricSelected = frame >= 40;
  const isDropdownOpened = frame >= 80 && frame < 120;
  const isCreatingProgress = frame >= 125;

  return (
    <FeatureSlide
      badge="02 / SUPPORTED LOADERS"
      title="All Major Loaders Supported"
      description="Automatic setup for Vanilla, Fabric, Forge, Paper, Spigot, and NeoForge. Detects compatible Java versions and configs automatically."
      windowTitle="Mace - Create Server Instance"
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Background base screenshot */}
        <img
          src={staticFile('Screenshots/Screenshot 2026-01-01 064408.png')}
          alt="Create Server Screenshot"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Dynamic Highlight Overlays */}
        {/* Fabric Loader Card Selected Glow */}
        {isFabricSelected && (
          <div
            style={{
              position: 'absolute',
              left: '30%',
              top: '26%',
              width: '18%',
              height: '19%',
              border: '2.5px solid var(--accent)',
              borderRadius: '10px',
              pointerEvents: 'none',
              boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)',
              transition: 'all 0.15s ease-out',
            }}
          />
        )}

        {/* Java dropdown list opening animation */}
        {isDropdownOpened && (
          <div
            style={{
              position: 'absolute',
              left: '26%',
              top: '71%',
              width: '48%',
              height: '100px',
              backgroundColor: '#181825',
              border: '1.5px solid var(--border-glass-bright)',
              borderRadius: '6px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.7)',
              padding: '6px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontFamily: 'sans-serif',
              zIndex: 50,
            }}
          >
            <div style={{ padding: '6px 8px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--primary)' }}>
              ✦ Java 21 (Recommended for 1.20.6+)
            </div>
            <div style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
              ✦ Java 17 (Recommended for 1.18 - 1.20.4)
            </div>
          </div>
        )}

        {/* Create Progress Overlay */}
        {isCreatingProgress && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(9, 13, 22, 0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            {/* Spinning Loader */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '4px solid rgba(16, 185, 129, 0.2)',
                borderTopColor: 'var(--primary)',
                animation: 'spin 1s linear infinite',
                marginBottom: '20px',
              }}
            />
            <span
              className="font-outfit"
              style={{
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                letterSpacing: '1px',
              }}
            >
              Downloading Fabric Loader & Assets...
            </span>

            {/* Custom spinner keyframes keyframe styling style inside jsx */}
            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}
            </style>
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
