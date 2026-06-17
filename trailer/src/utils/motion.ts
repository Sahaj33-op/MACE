import { interpolate, spring } from 'remotion';

export interface MotionKeyframe {
  frame: number;
  x: number; // Percentage (0 to 100) or pixels
  y: number; // Percentage (0 to 100) or pixels
  click?: boolean;
}

/**
 * Interpolates a cursor path based on defined keyframes
 */
export function getCursorState(frame: number, keyframes: MotionKeyframe[], fps: number = 30) {
  if (keyframes.length === 0) {
    return { x: 0, y: 0, clickProgress: 0, isClicked: false, lastClickFrame: -1 };
  }

  // Find the current keyframe interval
  let startIdx = 0;
  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].frame <= frame) {
      startIdx = i;
    }
  }

  const startKf = keyframes[startIdx];
  const endKf = keyframes[Math.min(startIdx + 1, keyframes.length - 1)];

  let x = startKf.x;
  let y = startKf.y;

  if (startKf !== endKf && endKf.frame > startKf.frame) {
    // Smooth transition using bezier or standard linear interpolation
    // Standard linear is fine since keyframes can be placed close for ease-in-out
    const progress = (frame - startKf.frame) / (endKf.frame - startKf.frame);
    
    // Simple ease-in-out interpolation
    const easeProgress = progress < 0.5 
      ? 2 * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    x = interpolate(easeProgress, [0, 1], [startKf.x, startKf.y], { extrapolateRight: 'clamp' });
    
    // Wait, the end coordinate should be endKf's x/y
    x = interpolate(easeProgress, [0, 1], [startKf.x, endKf.x], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    y = interpolate(easeProgress, [0, 1], [startKf.y, endKf.y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }

  // Find the last click frame that occurred at or before the current frame
  let lastClickFrame = -1;
  for (let i = startIdx; i >= 0; i--) {
    if (keyframes[i].click) {
      lastClickFrame = keyframes[i].frame;
      break;
    }
  }

  // Calculate click animation scale (spring-based)
  let clickProgress = 0; // 0 is normal, 1 is fully clicked (scale down)
  let isClicked = false;
  if (lastClickFrame !== -1 && frame >= lastClickFrame && frame < lastClickFrame + 15) {
    isClicked = true;
    const clickFrameDelta = frame - lastClickFrame;
    // Spring physics for click scale
    clickProgress = spring({
      frame: clickFrameDelta,
      fps,
      config: {
        damping: 10,
        mass: 0.5,
        stiffness: 150,
      },
    });
  }

  return {
    x,
    y,
    clickProgress,
    isClicked,
    lastClickFrame,
  };
}
