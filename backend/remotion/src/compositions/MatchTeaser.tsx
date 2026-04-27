import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface MatchTeaserProps {
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds: number;
  backgroundImage: string | null;
}

export const MatchTeaser: React.FC<MatchTeaserProps> = ({
  homeTeam, awayTeam, homeOdds, awayOdds, drawOdds, backgroundImage
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const vsScale = spring({ frame: frame - 20, fps, config: { damping: 12 } });
  const oddsOpacity = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' });
  const oddsY = interpolate(frame, [50, 70], [30, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a1a', fontFamily: 'Arial, sans-serif', direction: 'rtl' }}>
      {backgroundImage && (
        <AbsoluteFill>
          <img src={backgroundImage} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} />
        </AbsoluteFill>
      )}

      {/* Header */}
      <div style={{ position: 'absolute', top: 80, width: '100%', textAlign: 'center', opacity: headerOpacity }}>
        <div style={{ fontSize: 36, color: '#4CAF50', fontWeight: 'bold', letterSpacing: 4 }}>KICKOFF</div>
        <div style={{ fontSize: 22, color: '#aaa', marginTop: 8 }}>ליגת האלופות 2026</div>
      </div>

      {/* Teams */}
      <div style={{
        position: 'absolute', top: '30%', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 52, fontWeight: 'bold', color: '#fff' }}>{homeTeam}</div>
        </div>
        <div style={{ transform: `scale(${vsScale})`, fontSize: 64, color: '#4CAF50', fontWeight: 'bold' }}>VS</div>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 52, fontWeight: 'bold', color: '#fff' }}>{awayTeam}</div>
        </div>
      </div>

      {/* Odds */}
      <div style={{
        position: 'absolute', bottom: 200, width: '100%',
        display: 'flex', justifyContent: 'space-around',
        opacity: oddsOpacity, transform: `translateY(${oddsY}px)`,
      }}>
        {[
          { label: 'בית', value: homeOdds },
          { label: 'תיקו', value: drawOdds },
          { label: 'אורח', value: awayOdds },
        ].map(({ label, value }) => (
          <div key={label} style={{
            textAlign: 'center', padding: '20px 32px',
            background: 'rgba(76,175,80,0.15)', borderRadius: 16,
            border: '2px solid #4CAF50',
          }}>
            <div style={{ fontSize: 24, color: '#aaa' }}>{label}</div>
            <div style={{ fontSize: 48, fontWeight: 'bold', color: '#4CAF50' }}>{value.toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{
        position: 'absolute', bottom: 100, width: '100%', textAlign: 'center',
        opacity: oddsOpacity,
      }}>
        <div style={{ fontSize: 28, color: '#fff', background: '#4CAF50', display: 'inline-block', padding: '16px 48px', borderRadius: 50 }}>
          הצטרף להימור עכשיו
        </div>
      </div>
    </AbsoluteFill>
  );
};
