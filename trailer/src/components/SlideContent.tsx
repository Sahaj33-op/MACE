import React from 'react';
import { useCurrentFrame, useVideoConfig, staticFile } from 'remotion';
import { FeatureSlide } from './FeatureSlide';
import { SimulatedPointer } from './SimulatedPointer';
import { getCursorState, MotionKeyframe } from '../utils/motion';

export const SlideContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Define pointer movement path keyframes
  const path: MotionKeyframe[] = [
    { frame: 0, x: -10, y: 50 }, // Start off left
    { frame: 35, x: 22, y: 32 }, // Hover over "Mods" tab
    { frame: 40, x: 22, y: 32, click: true }, // Select "Mods" tab
    { frame: 75, x: 75, y: 45 }, // Move to a Mod toggle switch
    { frame: 80, x: 75, y: 45, click: true }, // Enable a mod
    { frame: 120, x: 88, y: 15 }, // Move to "Install New" button
    { frame: 125, x: 88, y: 15, click: true }, // Click "Install New"
    { frame: 180, x: 110, y: 50 }, // Exit right
  ];

  const cursor = getCursorState(frame, path, fps);

  // Simulated UI responses based on frame count
  const isModsTabSelected = frame >= 40;
  const isModEnabled = frame >= 80;
  const isModalOpen = frame >= 125;

  return (
    <FeatureSlide
      badge="04 / CONTENT MANAGEMENT"
      title="Mods, Plugins & Datapacks"
      description="Easily browse, install, and toggle server content. Fully integrated with Modrinth and CurseForge to fetch the latest versions directly."
      windowTitle="Mace - Mods & Content"
    >
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Background base screenshot */}
        <img
          src={staticFile('Screenshots/Screenshot 2026-01-01 064335.png')}
          alt="Content Management Screenshot"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Dynamic Highlight Overlays */}
        {/* Switch Toggle State Animation Overlay */}
        {isModEnabled && (
          <div
            style={{
              position: 'absolute',
              left: '38%',
              top: '32%',
              width: '42px',
              height: '24px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid var(--primary)',
              borderRadius: '12px',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '18px',
              boxSizing: 'border-box',
              transition: 'all 0.1s ease',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
              }}
            />
          </div>
        )}

        {/* Mod download progress card overlay */}
        {isDownloading && (
          <div
            style={{
              position: 'absolute',
              left: '52%',
              top: '40%',
              width: '40%',
              backgroundColor: '#11111b',
              border: '1.5px solid var(--border-glass-bright)',
              borderRadius: '8px',
              padding: '12px',
              boxSizing: 'border-box',
              zIndex: 60,
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6)',
              animation: 'fadeIn 0.1s ease-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <span>Downloading JEI (Just Enough Items)...</span>
              <span>{Math.floor(downloadProgressWidth)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${downloadProgressWidth}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent), var(--primary))',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        )}

        {/* Mod install completion confirmation toast */}
        {isInstalled && (
          <div
            style={{
              position: 'absolute',
              left: '52%',
              top: '40%',
              width: '40%',
              backgroundColor: '#0f172a',
              border: '1.5px solid var(--primary)',
              borderRadius: '8px',
              padding: '10px 16px',
              boxSizing: 'border-box',
              zIndex: 60,
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            <span style={{ color: 'var(--primary)', fontSize: '15px' }}>✓</span>
            <span>Mod JEI Installed Successfully!</span>
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
