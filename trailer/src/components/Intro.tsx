import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from 'remotion';
import { TypeWriter } from './TypeWriter';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation for the logo
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.8,
    },
  });

  // Entrance animation for the container card (fade & slide up)
  const cardTranslateY = interpolate(frame, [0, 25], [100, 0], {
    extrapolateRight: 'clamp',
  });
  const cardOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Logo glowing aura animation (pulse)
  const pulseScale = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.95, 1.05]
  );

  // Logo rotation (slow spin during intro)
  const logoRotate = interpolate(frame, [0, 150], [0, 8], {
    extrapolateRight: 'clamp',
  });

  // Subtitle reveal delay (frame 40)
  const showSubtitle = frame > 40;

  return (
    <div
      style={{
        flex: 1,
        background: 'var(--bg-gradient)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
      }}
    >
      {/* Background Grid Accent */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(rgba(16, 185, 129, 0.05) 1.5px, transparent 1.5px)',
          backgroundSize: '36px 36px',
          opacity: 0.8,
        }}
      />

      {/* Decorative Glow Spheres */}
      <div className="glow-effect" style={{ top: '20%', left: '35%', transform: `scale(${pulseScale})` }} />
      <div className="glow-effect glow-blue" style={{ bottom: '20%', right: '35%', transform: `scale(${pulseScale * 0.9})` }} />

      {/* Glassmorphic Container Card */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${cardTranslateY}px)`,
          opacity: cardOpacity,
          padding: '60px 80px',
          maxWidth: '800px',
          width: '80%',
        }}
      >
        {/* App Icon */}
        <div
          style={{
            transform: `scale(${logoScale}) rotate(${logoRotate}deg)`,
            marginBottom: '30px',
            position: 'relative',
          }}
        >
          {/* Inner shadow/glow behind the icon */}
          <div
            style={{
              position: 'absolute',
              top: '-10px',
              left: '-10px',
              right: '-10px',
              bottom: '-10px',
              borderRadius: '32px',
              background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
              opacity: 0.3,
              filter: 'blur(10px)',
            }}
          />
          <img
            src={staticFile('appicon.png')}
            alt="Mace App Icon"
            style={{
              width: '180px',
              height: '180px',
              borderRadius: '40px',
              border: '2px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* Title */}
        <h1
          className="font-outfit"
          style={{
            fontSize: '84px',
            margin: '0 0 16px 0',
            letterSpacing: '-2px',
            fontWeight: 800,
            textAlign: 'center',
          }}
        >
          <span className="title-gradient">MACE</span>
        </h1>

        {/* Subtitle with TypeWriter effect */}
        <p
          style={{
            fontSize: '24px',
            color: 'var(--text-secondary)',
            margin: 0,
            textAlign: 'center',
            minHeight: '36px',
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {showSubtitle && (
            <TypeWriter
              text="The Lightweight, Cross-Platform Minecraft Server Manager"
              currentFrame={frame}
              startFrame={45}
              speed={0.6}
              showCursor={true}
            />
          )}
        </p>
      </div>
    </div>
  );
};
