import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

interface FeatureSlideProps {
  badge: string;
  title: string;
  description: string;
  windowTitle?: string;
  children: React.ReactNode;
}

export const FeatureSlide: React.FC<FeatureSlideProps> = ({
  badge,
  title,
  description,
  windowTitle = 'Mace Instance Manager',
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Entrance animations (spring-based)
  // Text panel slides in from the left
  const textTranslateX = interpolate(frame, [0, 20], [-100, 0], {
    extrapolateRight: 'clamp',
  });
  const textOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // OS window slides and scales in from the right
  const windowSpring = spring({
    frame,
    fps,
    config: {
      damping: 14,
      stiffness: 90,
    },
  });
  
  const windowScale = interpolate(windowSpring, [0, 1], [0.85, 1]);
  const windowTranslateX = interpolate(windowSpring, [0, 1], [150, 0]);
  const windowOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Outbound animation (fade/slide out in the last 15 frames)
  const duration = 180; // Default scene length in parent
  const exitStartFrame = duration - 15;
  
  let exitTranslateX = 0;
  let exitOpacity = 1;
  
  if (frame > exitStartFrame) {
    const exitDelta = frame - exitStartFrame;
    exitTranslateX = interpolate(exitDelta, [0, 15], [0, -80], {
      extrapolateRight: 'clamp',
    });
    exitOpacity = interpolate(exitDelta, [0, 15], [1, 0], {
      extrapolateRight: 'clamp',
    });
  }

  return (
    <div
      style={{
        flex: 1,
        background: 'var(--bg-gradient)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 80px',
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
        opacity: exitOpacity,
      }}
    >
      {/* Background radial glowing gradients */}
      <div className="glow-effect" style={{ top: '-10%', right: '10%', opacity: 0.7 }} />
      <div className="glow-effect glow-blue" style={{ bottom: '-10%', left: '10%', opacity: 0.7 }} />

      {/* Left Column: Descriptions */}
      <div
        style={{
          width: '38%',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateX(${textTranslateX + exitTranslateX}px)`,
          opacity: textOpacity,
        }}
      >
        {/* Badge Indicator */}
        <div
          className="font-outfit"
          style={{
            color: 'var(--primary)',
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '16px',
            textShadow: '0 0 10px rgba(16, 185, 129, 0.2)',
          }}
        >
          {badge}
        </div>

        {/* Feature Title */}
        <h2
          className="font-outfit"
          style={{
            fontSize: '48px',
            fontWeight: 800,
            margin: '0 0 20px 0',
            lineHeight: 1.15,
            letterSpacing: '-1px',
          }}
        >
          <span className="title-gradient">{title}</span>
        </h2>

        {/* Separator line */}
        <div
          style={{
            height: '4px',
            width: '60px',
            background: 'linear-gradient(90deg, var(--primary), var(--accent))',
            borderRadius: '2px',
            marginBottom: '28px',
          }}
        />

        {/* Paragraph Details */}
        <p
          style={{
            fontSize: '18px',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {description}
        </p>
      </div>

      {/* Right Column: Framed Viewport */}
      <div
        style={{
          width: '56%',
          transform: `translateX(${windowTranslateX + exitTranslateX}px) scale(${windowScale})`,
          opacity: windowOpacity,
        }}
      >
        <div className="os-window">
          {/* OS Window Header Header decoration */}
          <div className="window-header">
            <div className="window-dot red" />
            <div className="window-dot yellow" />
            <div className="window-dot green" />
            <div className="window-title">{windowTitle}</div>
          </div>

          {/* Actual Child Component / Screenshot Visuals */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16/10', // Standard layout ratio matching screenshot dimensions
              background: '#0d1117',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
