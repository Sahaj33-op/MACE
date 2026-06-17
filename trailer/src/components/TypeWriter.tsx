import React from 'react';
import { interpolate } from 'remotion';

interface TypeWriterProps {
  text: string;
  currentFrame: number;
  startFrame: number;
  speed?: number; // Characters per frame
  showCursor?: boolean;
}

export const TypeWriter: React.FC<TypeWriterProps> = ({
  text,
  currentFrame,
  startFrame,
  speed = 1,
  showCursor = true,
}) => {
  const elapsed = currentFrame - startFrame;
  if (elapsed < 0) {
    return null;
  }

  const visibleCharCount = Math.min(text.length, Math.floor(elapsed * speed));
  const visibleText = text.slice(0, visibleCharCount);
  
  // Cursor blinking animation every 10 frames
  const cursorBlink = showCursor && visibleCharCount < text.length || (Math.floor(elapsed / 10) % 2 === 0);

  return (
    <span>
      {visibleText}
      {showCursor && (
        <span
          style={{
            opacity: cursorBlink ? 1 : 0,
            color: 'var(--primary)',
            marginLeft: '2px',
            fontWeight: 'bold',
          }}
        >
          ▋
        </span>
      )}
    </span>
  );
};
