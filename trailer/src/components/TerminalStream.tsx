import React, { useEffect, useRef } from 'react';
import { interpolate } from 'remotion';

interface TerminalLine {
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
  delay: number; // frame index relative to start
}

interface TerminalStreamProps {
  lines: TerminalLine[];
  currentFrame: number;
  startFrame: number;
}

export const TerminalStream: React.FC<TerminalStreamProps> = ({
  lines,
  currentFrame,
  startFrame,
}) => {
  const elapsedFrames = currentFrame - startFrame;
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Filter lines that should be visible based on delay
  const visibleLines = lines.filter((line) => elapsedFrames >= line.delay);

  // Custom styling mappings
  const getClass = (type: TerminalLine['type']) => {
    switch (type) {
      case 'success':
        return 'terminal-success';
      case 'error':
        return 'terminal-error';
      case 'warn':
        return 'terminal-warn';
      default:
        return 'terminal-info';
    }
  };

  const getPrefix = (type: TerminalLine['type']) => {
    switch (type) {
      case 'success':
        return '[SUCCESS]';
      case 'error':
        return '[ERROR]  ';
      case 'warn':
        return '[WARNING]';
      default:
        return '[INFO]   ';
    }
  };

  return (
    <div className="terminal-window">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {visibleLines.map((line, idx) => (
          <div key={idx} className={`terminal-line ${getClass(line.type)}`}>
            <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>
              {getTimestamp(line.delay)}
            </span>
            <span>{getPrefix(line.type)}</span>
            <span>{line.text}</span>
          </div>
        ))}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

// Helper to generate a realistic log timestamp
function getTimestamp(delayFrames: number) {
  const date = new Date(2026, 5, 16, 17, 45, 0); // Starting date anchor
  date.setSeconds(date.getSeconds() + Math.floor(delayFrames / 10)); // Accelerate logs
  
  const hrs = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  const secs = date.getSeconds().toString().padStart(2, '0');
  
  return `${hrs}:${mins}:${secs}`;
}
