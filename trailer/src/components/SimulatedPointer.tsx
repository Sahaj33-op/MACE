import React from 'react';
import { interpolate } from 'remotion';

interface SimulatedPointerProps {
  x: number; // Percentage (0 - 100)
  y: number; // Percentage (0 - 100)
  clickProgress: number; // 0 to 1
  lastClickFrame: number;
  currentFrame: number;
}

export const SimulatedPointer: React.FC<SimulatedPointerProps> = ({
  x,
  y,
  clickProgress,
  lastClickFrame,
  currentFrame,
}) => {
  // Scale down the cursor during click
  const cursorScale = interpolate(clickProgress, [0, 1], [1, 0.8]);

  // Click ripple calculation
  const framesSinceClick = currentFrame - lastClickFrame;
  const showRipple = lastClickFrame !== -1 && framesSinceClick >= 0 && framesSinceClick < 25;

  let rippleScale = 0;
  let rippleOpacity = 0;

  if (showRipple) {
    // Ripple expands outward
    rippleScale = interpolate(framesSinceClick, [0, 25], [0, 4.5], {
      extrapolateRight: 'clamp',
    });
    // Ripple fades out
    rippleOpacity = interpolate(framesSinceClick, [0, 8, 25], [0.8, 0.7, 0], {
      extrapolateRight: 'clamp',
    });
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-5px, -5px)', // Offset pointer tip slightly
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {/* Click Ripple Indicator */}
      {showRipple && (
        <div
          className="click-ripple"
          style={{
            width: '40px',
            height: '40px',
            transform: `translate(-50%, -50%) scale(${rippleScale})`,
            opacity: rippleOpacity,
            borderColor: 'var(--primary)',
            boxShadow: `0 0 10px rgba(16, 185, 129, ${rippleOpacity * 0.5})`,
          }}
        />
      )}

      {/* SVG Mouse Pointer */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          transform: `scale(${cursorScale})`,
          transformOrigin: 'top left',
          filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.4))',
        }}
      >
        <path
          d="M2.5 2V21.5L8.5 15.5H17.5L2.5 2Z"
          fill="white"
          stroke="black"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
