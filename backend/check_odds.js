const axios = require('axios');

const LEAGUES = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'uefa.champions'];

async function checkOdds() {
  const report = {};
  for (const league of LEAGUES) {
    try {
      const { data } = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`, { timeout: 10000 });
      const events = data.events || [];
      const withOdds = events.filter(e => e.competitions[0].odds && e.competitions[0].odds.length > 0);
      report[league] = {
        total_events: events.length,
        events_with_odds: withOdds.length,
        has_predictor: events.some(e => e.predictor) || false
      };
    } catch (e) {
      report[league] = { error: e.message };
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

checkOdds();
