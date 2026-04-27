import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface AppFeatureProps {
  featureTitle: string;
  featureDescription: string;
  ctaText: string;
  accentColor: string;
}

export const AppFeature: React.FC<AppFeatureProps> = ({
  featureTitle, featureDescription, ctaText, accentColor
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = interpolate(frame, [0, 30], [60, 0], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const descScale = spring({ frame: frame - 30, fps, config: { damping: 14 } });
  const ctaOpacity = interpolate(frame, [70, 90], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(160deg, #0a0a1a 0%, ${accentColor}22 100%)`,
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 40,
    }}>
      <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOpacity, textAlign: 'center' }}>
        <div style={{ fontSize: 28, color: accentColor, letterSpacing: 6, fontWeight: 'bold' }}>KICKOFF</div>
        <div style={{ fontSize: 72, color: '#fff', fontWeight: 'bold', marginTop: 16 }}>{featureTitle}</div>
      </div>

      <div style={{ transform: `scale(${descScale})`, textAlign: 'center', maxWidth: '80%' }}>
        <div style={{ fontSize: 36, color: '#ccc', lineHeight: 1.5 }}>{featureDescription}</div>
      </div>

      <div style={{
        opacity: ctaOpacity,
        background: accentColor,
        padding: '20px 64px',
        borderRadius: 60,
        fontSize: 32,
        color: '#fff',
        fontWeight: 'bold',
      }}>
        {ctaText}
      </div>
    </AbsoluteFill>
  );
};
