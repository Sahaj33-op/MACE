import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate, staticFile } from 'remotion';
import { TypeWriter } from './TypeWriter';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation for the logo
  const logoScale = spring({
    frame,
    fps,
    config: {
      damping: 15,
      stiffness: 120,
    },
  });

  // Entrance animation for content details
  const contentTranslateY = interpolate(frame, [10, 30], [50, 0], {
    extrapolateRight: 'clamp',
  });
  const contentOpacity = interpolate(frame, [10, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Website button entrance scale and glow pulsing
  const buttonScale = spring({
    frame: frame - 35,
    fps,
    config: {
      damping: 10,
      stiffness: 100,
    },
  });

  const glowPulse = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [10, 25]
  );

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
      <div className="glow-effect" style={{ top: '15%', left: '20%' }} />
      <div className="glow-effect glow-blue" style={{ bottom: '15%', right: '20%' }} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `translateY(${contentTranslateY}px)`,
          opacity: contentOpacity,
          width: '90%',
          maxWidth: '900px',
        }}
      >
        {/* App Icon */}
        <div style={{ transform: `scale(${logoScale})`, marginBottom: '25px' }}>
          <img
            src={staticFile('appicon.png')}
            alt="Mace Logo"
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '24px',
              border: '2px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            }}
          />
        </div>

        {/* Title */}
        <h2
          className="font-outfit"
          style={{
            fontSize: '54px',
            margin: '0 0 16px 0',
            textAlign: 'center',
            fontWeight: 800,
            letterSpacing: '-1px',
          }}
        >
          <span className="title-gradient">Take Control of Your Minecraft Servers</span>
        </h2>

        {/* Subtitle description */}
        <p
          style={{
            fontSize: '20px',
            color: 'var(--text-secondary)',
            margin: '0 0 40px 0',
            textAlign: 'center',
            maxWidth: '650px',
            lineHeight: 1.6,
          }}
        >
          A seamless experience for server administrators. Support for custom loaders, live logs, automatic backups, and integrated mods installer.
        </p>

        {/* Glowing Button for Website */}
        {frame > 30 && (
          <div
            style={{
              transform: `scale(${buttonScale})`,
              boxShadow: `0 0 ${glowPulse}px rgba(16, 185, 129, 0.4)`,
              borderRadius: '16px',
              transition: 'box-shadow 0.1s ease',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '16px 36px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                className="font-outfit"
                style={{
                  fontSize: '26px',
                  fontWeight: 'bold',
                  color: 'white',
                  letterSpacing: '0.5px',
                }}
              >
                mace-7yf.pages.dev
              </span>
            </div>
          </div>
        )}

        {/* Platforms supported badge */}
        <div
          style={{
            marginTop: '45px',
            fontSize: '14px',
            color: 'var(--text-muted)',
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
          }}
        >
          <span>✦ Windows</span>
          <span>✦ macOS</span>
          <span>✦ Linux</span>
        </div>
      </div>
    </div>
  );
};
