import React from 'react';
import { Composition } from 'remotion';
import { MatchTeaser } from './compositions/MatchTeaser';
import { AppFeature } from './compositions/AppFeature';
import { GenericPromo } from './compositions/GenericPromo';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="MatchTeaser"
        component={MatchTeaser}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          homeTeam: 'מכבי ת"א',
          awayTeam: 'הפועל',
          homeOdds: 1.85,
          awayOdds: 2.15,
          drawOdds: 3.10,
          backgroundImage: null,
        }}
      />
      <Composition
        id="AppFeature"
        component={AppFeature}
        durationInFrames={120}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          featureTitle: 'KickOff',
          featureDescription: 'הימורי כדורגל חכמים',
          ctaText: 'הצטרף עכשיו',
          accentColor: '#4CAF50',
        }}
      />
      <Composition
        id="GenericPromo"
        component={GenericPromo}
        durationInFrames={90}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: 'KickOff',
          subline: 'הפלטפורמה החברתית לכדורגל',
          backgroundImage: null,
          accentColor: '#4CAF50',
        }}
      />
    </>
  );
};
