import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion';
import { FeatureSlide } from './FeatureSlide';
import { TerminalStream } from './TerminalStream';
import { SimulatedPointer } from './SimulatedPointer';
import { getCursorState, MotionKeyframe } from '../utils/motion';

export const SlideCrash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Define pointer movement path keyframes
  // Moves to click the "Accept EULA & Restart" diagnostic fix button
  const path: MotionKeyframe[] = [
    { frame: 0, x: 20, y: -20 }, // Start off top-left
    { frame: 100, x: 72, y: 72 }, // Move to accepting eula diagnostic helper button
    { frame: 105, x: 72, y: 72, click: true }, // Click Accept & Fix
    { frame: 180, x: 50, y: 120 }, // Exit down
  ];

  const cursor = getCursorState(frame, path, fps);

  // Core logs sequence
  const serverLogs = [
    // Pre-click logs (EULA Crash)
    { text: 'Starting Minecraft Server Instance...', type: 'info' as const, delay: 5 },
    { text: 'Checking Java environment... JDK 21 detected.', type: 'info' as const, delay: 15 },
    { text: 'Loading libraries and server properties...', type: 'info' as const, delay: 25 },
    { text: 'Stopping server: eula.txt has not been accepted!', type: 'warn' as const, delay: 40 },
    { text: 'FAILED to load eula.txt. Acceptance required.', type: 'error' as const, delay: 52 },
    { text: 'Server process closed with error exit code: 1', type: 'error' as const, delay: 65 },
    { text: 'Watchdog: Crash detected! Launching Analyzer...', type: 'warn' as const, delay: 75 },
    
    // Post-click logs (Resolution restart)
    { text: 'Watchdog auto-resolving: accepted EULA in eula.txt', type: 'success' as const, delay: 110 },
    { text: 'Watchdog: relaunching server instance...', type: 'info' as const, delay: 125 },
    { text: 'Starting Minecraft Server Instance...', type: 'info' as const, delay: 140 },
    { text: 'Server loaded. Listening on port 25565 (UDP/TCP)', type: 'success' as const, delay: 155 },
    { text: 'Server started successfully! Status: ONLINE', type: 'success' as const, delay: 170 },
  ];

  // Animated popup for "Crash Detected!" alert
  let alertOpacity = 0;
  let alertScale = 0;
  if (frame >= 75 && frame < 110) {
    alertOpacity = interpolate(frame, [75, 80], [0, 1], { extrapolateRight: 'clamp' });
    alertScale = interpolate(frame, [75, 82], [0.8, 1], { extrapolateRight: 'clamp' });
  }

  // Acceptance checkmark overlay
  const showFixSuccess = frame >= 110;

  return (
    <FeatureSlide
      badge="03 / CRASH ANALYSIS & WATCHDOG"
      title="Intelligent Crash Watchdog"
      description="Monitors server logs in real-time. If a crash occurs, Mace diagnoses common issues (e.g. unaccepted EULA, port conflicts, Java mismatches) and repairs them."
      windowTitle="Mace - Terminal Console & Watchdog"
    >
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
        {/* Left Side: Live Console Stream */}
        <div style={{ width: '48%', height: '100%', boxSizing: 'border-box', borderRight: '1px solid var(--border-glass)' }}>
          <TerminalStream lines={serverLogs} currentFrame={frame} startFrame={0} />
        </div>

        {/* Right Side: Visual Diagnostic Screen Screenshot */}
        <div style={{ width: '52%', height: '100%', position: 'relative' }}>
          <img
            src={staticFile('Screenshots/Screenshot 2026-01-01 06444g4.png')}
            alt="Crash Analyzer Screenshot"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* CRASH DETECTED Alert Banner Overlay */}
          {alertOpacity > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '10%',
                top: '25%',
                width: '80%',
                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                border: '2px solid #ef4444',
                borderRadius: '12px',
                padding: '16px',
                boxSizing: 'border-box',
                boxShadow: '0 10px 30px rgba(239, 68, 68, 0.4)',
                opacity: alertOpacity,
                transform: `scale(${alertScale})`,
                zIndex: 40,
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '20px',
                }}
              >
                ⚠
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', color: 'white' }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>CRASH DETECTED</span>
                <span style={{ fontSize: '12px', opacity: 0.95 }}>Resolution: Missing EULA acceptance</span>
              </div>
            </div>
          )}

          {/* Accepting diagnostic glow overlay on the Accept EULA button */}
          {frame >= 100 && frame < 110 && (
            <div
              style={{
                position: 'absolute',
                left: '60%',
                top: '68%',
                width: '32%',
                height: '10%',
                border: '2px solid var(--primary)',
                borderRadius: '6px',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.6)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Success RESOLVED overlay */}
          {showFixSuccess && (
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
                zIndex: 80,
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 'bold',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.5)',
                  marginBottom: '15px',
                }}
              >
                ✓
              </div>
              <span
                className="font-outfit"
                style={{
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  letterSpacing: '0.5px',
                }}
              >
                Watchdog Resolution Applied!
              </span>
            </div>
          )}
        </div>

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
