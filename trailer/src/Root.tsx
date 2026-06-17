import React from 'react';
import { Composition } from 'remotion';
import { Trailer } from './Trailer';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Trailer"
        component={Trailer}
        durationInFrames={900} // 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
