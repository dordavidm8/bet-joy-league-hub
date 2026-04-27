import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

interface GenericPromoProps {
  headline: string;
  subline: string;
  backgroundImage: string | null;
  accentColor: string;
}

export const GenericPromo: React.FC<GenericPromoProps> = ({
  headline, subline, backgroundImage, accentColor
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const headlineScale = interpolate(frame, [10, 40], [0.7, 1], { extrapolateRight: 'clamp' });
  const sublineY = interpolate(frame, [30, 55], [40, 0], { extrapolateRight: 'clamp' });
  const sublineOpacity = interpolate(frame, [30, 55], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0a1a',
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 32,
      opacity,
    }}>
      {backgroundImage && (
        <AbsoluteFill>
          <img src={backgroundImage} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />
        </AbsoluteFill>
      )}

      <div style={{ transform: `scale(${headlineScale})`, textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 96, fontWeight: 'bold', color: accentColor }}>{headline}</div>
      </div>

      <div style={{
        transform: `translateY(${sublineY}px)`,
        opacity: sublineOpacity,
        textAlign: 'center',
        maxWidth: '80%',
        zIndex: 1,
      }}>
        <div style={{ fontSize: 40, color: '#fff', lineHeight: 1.4 }}>{subline}</div>
      </div>
    </AbsoluteFill>
  );
};
