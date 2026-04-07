const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: !isLocal ? { rejectUnauthorized: false } : false,
});

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const axiosConfig = (url) => {
  const domain = new URL(url).hostname;
  return {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': `https://${domain}/`,
      'Upgrade-Insecure-Requests': '1'
    },
    timeout: 15000
  };
};

// ── ESPN API helpers ───────────────────────────────────────────────────────────

/**
 * Fetch a list of recently completed matches from ESPN for a given league.
 * Returns an array of { id, name } objects.
 */
async function fetchRecentEspnMatchIds(league) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;
  console.log(`[generateMiniGames] Fetching recent scoreboard for ${league}`);
  const res = await axios.get(url, { timeout: 10000 });
  const events = res.data?.events || [];
  // Keep only STATUS_FINAL matches (completed)
  return events
    .filter(e => e.status?.type?.completed === true)
    .map(e => ({ id: e.id, name: e.name }));
}

async function fetchEspnMatch(league, eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`;
  console.log(`[generateMiniGames] Fetching ESPN match summary: event=${eventId} league=${league}`);
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

// ── generateMissingXI (dynamic ESPN matches) ─────────────────────────────────

async function generateMissingXI() {
  const leagues = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];

  let starters = [];
  let teamName = '';
  let teamLogo = '';

  // Shuffle leagues and try each until we find a match with rosters
  const shuffledLeagues = [...leagues].sort(() => Math.random() - 0.5);

  for (const league of shuffledLeagues) {
    let recentMatches = [];
    try {
      recentMatches = await fetchRecentEspnMatchIds(league);
    } catch (e) {
      console.warn(`[generateMissingXI] Could not fetch scoreboard for ${league}: ${e.message}`);
      continue;
    }

    if (recentMatches.length === 0) continue;

    // Shuffle and try up to 5 matches from this league
    const shuffled = recentMatches.sort(() => Math.random() - 0.5).slice(0, 5);

    for (const match of shuffled) {
      console.log(`[generateMissingXI] Trying match "${match.name}" (${match.id}) in ${league}...`);
      try {
        const data = await fetchEspnMatch(league, match.id);
        if (data.rosters && data.rosters.length >= 2) {
          const teamIdx = Math.random() < 0.5 ? 0 : 1;
          const roster = data.rosters[teamIdx];
          teamName = roster.team.displayName;
          teamLogo = roster.team.logo || (roster.team.logos && roster.team.logos[0]?.href) || '';

          const allPlayers = (roster.roster || roster.entries || [])
            .map(e => ({
              name: e.athlete.displayName,
              shirt: e.jersey || '?',
              position: e.athlete.position?.abbreviation,
              starter: e.starter
            }));

          starters = allPlayers.filter(p => p.starter === true);
          if (starters.length < 11) starters = allPlayers.slice(0, 11);

          if (starters.length >= 11) {
            console.log(`[generateMissingXI] Found valid roster: ${teamName} (${starters.length} starters)`);
            break;
          }
        }
      } catch (e) {
        console.warn(`[generateMissingXI] Failed match ${match.id}: ${e.message}`);
      }
    }

    if (starters.length >= 11) break;
  }

  if (starters.length < 11) {
    throw new Error(`Could not find a match with rosters across all leagues.`);
  }

  const formation = "4-3-3";
  // Hide one of players 1-10 (not the goalkeeper at index 0)
  const hiddenIdx = Math.floor(Math.random() * 10) + 1;
  const hiddenPlayerName = starters[hiddenIdx].name;

  const puzzlePlayers = starters.map((p, idx) => ({
    shirt: p.shirt,
    name: idx === hiddenIdx ? '???' : p.name
  }));

  return {
    game_type: 'missing_xi',
    puzzle_data: { teamName, teamLogo, formation, players: puzzlePlayers, hidden_idx: hiddenIdx },
    solution: { secret: hiddenPlayerName }
  };
}

// ── generateWhoAreYa (fixed image + position) ────────────────────────────────

async function generateWhoAreYa() {
  // Curated active star players with their Wikidata Q-IDs for reliable data
  const PLAYERS = [
    { name: 'Kylian Mbappé',    wikiSlug: 'Kylian_Mbappé',    qid: 'Q622294',  club: 'Real Madrid',      nat: 'France',    pos: 'Forward' },
    { name: 'Vinícius Júnior', wikiSlug: 'Vinícius_Júnior',  qid: 'Q4103216', club: 'Real Madrid',      nat: 'Brazil',    pos: 'Forward' },
    { name: 'Mohamed Salah',   wikiSlug: 'Mohamed_Salah',    qid: 'Q355767',  club: 'Liverpool',        nat: 'Egypt',     pos: 'Forward' },
    { name: 'Erling Haaland',  wikiSlug: 'Erling_Haaland',   qid: 'Q3373974', club: 'Manchester City',  nat: 'Norway',    pos: 'Striker' },
    { name: 'Jude Bellingham', wikiSlug: 'Jude_Bellingham',  qid: 'Q82513545',club: 'Real Madrid',      nat: 'England',   pos: 'Midfielder' },
    { name: 'Harry Kane',      wikiSlug: 'Harry_Kane',        qid: 'Q614977',  club: 'Bayern Munich',   nat: 'England',   pos: 'Striker' },
    { name: 'Rodri',           wikiSlug: 'Rodrigo_Hernández_Cascante', qid: 'Q20705898', club: 'Manchester City', nat: 'Spain', pos: 'Midfielder' },
    { name: 'Lamine Yamal',    wikiSlug: 'Lamine_Yamal',     qid: 'Q117374879', club: 'Barcelona',      nat: 'Spain',     pos: 'Forward' },
    { name: 'Phil Foden',      wikiSlug: 'Phil_Foden',        qid: 'Q26827088', club: 'Manchester City', nat: 'England',  pos: 'Midfielder' },
    { name: 'Bukayo Saka',     wikiSlug: 'Bukayo_Saka',       qid: 'Q58397482', club: 'Arsenal',         nat: 'England',  pos: 'Forward' },
    { name: 'Pedri',           wikiSlug: 'Pedri',             qid: 'Q104913567', club: 'Barcelona',      nat: 'Spain',    pos: 'Midfielder' },
    { name: 'Trent Alexander-Arnold', wikiSlug: 'Trent_Alexander-Arnold', qid: 'Q49095226', club: 'Real Madrid', nat: 'England', pos: 'Midfielder' },
  ];

  // Avoid repeating the same player from last 7 days
  let recentPlayers = [];
  try {
    const { rows } = await pool.query(`
      SELECT solution->>'secret' AS player
      FROM daily_mini_games
      WHERE game_type = 'who_are_ya'
        AND play_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    recentPlayers = rows.map(r => r.player).filter(Boolean);
  } catch (e) {
    console.warn('[generateWhoAreYa] Could not fetch recent players:', e.message);
  }

  const available = PLAYERS.filter(p => !recentPlayers.includes(p.name));
  const pool2 = available.length > 0 ? available : PLAYERS;
  const player = pool2[Math.floor(Math.random() * pool2.length)];

  // Try to get the player's photo from Wikipedia
  let image_url = '';
  try {
    const wikiUrl = `https://en.wikipedia.org/wiki/${player.wikiSlug}`;
    console.log(`[generateWhoAreYa] Fetching Wikipedia image for ${player.name}`);
    const res = await axios.get(wikiUrl, axiosConfig(wikiUrl));
    const $ = cheerio.load(res.data);
    const infobox = $('.infobox').first();
    let src = infobox.find('.infobox-image img').first().attr('src') || '';
    if (src && !src.startsWith('http')) src = 'https:' + src;
    if (src && src.includes('/')) {
      // Get 400px version for better quality
      image_url = src.replace(/\/\d+px-/, '/400px-');
    }
  } catch (e) {
    console.warn(`[generateWhoAreYa] Could not fetch Wikipedia image: ${e.message}`);
  }

  console.log(`[generateWhoAreYa] Player: ${player.name}, Club: ${player.club}, Nat: ${player.nat}, Image: ${image_url ? 'found' : 'none'}`);

  return {
    game_type: 'who_are_ya',
    puzzle_data: {
      image_url,
      nationality: player.nat,
      club: player.club,
      position: player.pos,
      age: null
    },
    solution: { secret: player.name }
  };
}


// ── generateCareerPath ────────────────────────────────────────────────────────

async function generateCareerPath() {
  const PLAYERS = [
    { slug: 'Cristiano_Ronaldo',   name: 'Cristiano Ronaldo' },
    { slug: 'Lionel_Messi',        name: 'Lionel Messi' },
    { slug: 'Zlatan_Ibrahimović',  name: 'Zlatan Ibrahimović' },
    { slug: 'Robert_Lewandowski',  name: 'Robert Lewandowski' },
    { slug: 'Luka_Modrić',         name: 'Luka Modrić' },
    { slug: 'Karim_Benzema',       name: 'Karim Benzema' },
    { slug: 'Erling_Haaland',      name: 'Erling Haaland' },
    { slug: 'Harry_Kane',          name: 'Harry Kane' },
    { slug: 'Kylian_Mbappé',       name: 'Kylian Mbappé' },
  ];

  // Avoid repeats from last 7 days
  let recentPlayers = [];
  try {
    const { rows } = await pool.query(`
      SELECT solution->>'secret' AS player
      FROM daily_mini_games
      WHERE game_type = 'career_path'
        AND play_date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    recentPlayers = rows.map(r => r.player).filter(Boolean);
  } catch (e) {}

  const available = PLAYERS.filter(p => !recentPlayers.includes(p.name));
  const pool2 = available.length > 0 ? available : PLAYERS;
  const player = pool2[Math.floor(Math.random() * pool2.length)];

  const url = `https://en.wikipedia.org/wiki/${player.slug}`;
  console.log(`[generateMiniGames] Fetching Wikipedia career: ${url}`);
  const res = await axios.get(url, axiosConfig(url));
  const $ = cheerio.load(res.data);
  const transfers = [];

  $('.infobox tr').each((i, el) => {
    const yearText = $(el).find('th').text().trim();
    if (/^\d{4}–(\d{4}|present)?$/.test(yearText) || /^\d{4}–$/.test(yearText)) {
      const tds = $(el).find('td');
      if (tds.length >= 2) {
        const club = $(tds[0]).text().trim().replace(/\[\d+\]/g, '');
        const stats = $(tds[1]).text().trim();
        const match = stats.match(/\((\d+)\)/);
        const appearances = stats.split('(')[0].trim();
        const goals = match ? match[1] : '0';

        if (club && club !== 'Total') {
          transfers.push({
            season: yearText,
            club,
            appearances: parseInt(appearances) || 0,
            goals: parseInt(goals) || 0
          });
        }
      }
    }
  });

  return {
    game_type: 'career_path',
    puzzle_data: { transfers },
    solution: { secret: player.name }
  };
}

// ── generateBox2Box (with anti-repeat logic) ──────────────────────────────────

async function generateBox2Box() {
  // Fetch pair combinations used in last 30 days to avoid repeats
  let recentPairs = [];
  try {
    const { rows } = await pool.query(`
      SELECT puzzle_data->>'team1' AS t1, puzzle_data->>'team2' AS t2
      FROM daily_mini_games
      WHERE game_type = 'box2box'
        AND play_date >= CURRENT_DATE - INTERVAL '30 days'
    `);
    recentPairs = rows.map(r => `${r.t1}|${r.t2}`);
  } catch (e) {
    console.warn('[generateBox2Box] Could not fetch recent pairs:', e.message);
  }

  // Query for a pair NOT used recently
  const query = `
    SELECT c1.club_name AS team1, c2.club_name AS team2
    FROM player_clubs c1
    JOIN player_clubs c2 ON c1.player_name = c2.player_name AND c1.club_name < c2.club_name
    GROUP BY c1.club_name, c2.club_name
    HAVING COUNT(DISTINCT c1.player_name) >= 1
    ORDER BY RANDOM()
    LIMIT 20;
  `;
  const { rows } = await pool.query(query);

  // Pick the first pair not in the recent list
  let chosen = null;
  for (const row of rows) {
    const key = `${row.team1}|${row.team2}`;
    if (!recentPairs.includes(key)) {
      chosen = row;
      break;
    }
  }
  // If all pairs were recently used, just pick randomly
  if (!chosen && rows.length > 0) {
    chosen = rows[Math.floor(Math.random() * rows.length)];
  }

  let team1 = 'Real Madrid', team2 = 'Juventus', solutionInfo = 'Cristiano Ronaldo';

  if (chosen) {
    team1 = chosen.team1;
    team2 = chosen.team2;

    const playerQuery = `
      SELECT c1.player_name 
      FROM player_clubs c1 
      JOIN player_clubs c2 ON c1.player_name = c2.player_name 
      WHERE c1.club_name = $1 AND c2.club_name = $2 
      LIMIT 1
    `;
    const playerRows = await pool.query(playerQuery, [team1, team2]);
    if (playerRows.rows.length > 0) solutionInfo = playerRows.rows[0].player_name;
  }

  return {
    game_type: 'box2box',
    puzzle_data: { team1, team2 },
    solution: { secret: solutionInfo }
  };
}

// ── generateGuessClub (uses ESPN scoreboard team logos directly) ───────────────

async function generateGuessClub() {
  const leagues = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1'];
  const shuffled = [...leagues].sort(() => Math.random() - 0.5);

  for (const league of shuffled) {
    try {
      // Get scoreboard - competitors have team info including logos
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`;
      console.log(`[generateGuessClub] Fetching scoreboard ${league}`);
      const res = await axios.get(url, { timeout: 10000 });
      const events = res.data?.events || [];

      if (events.length === 0) continue;

      // Try a few random events
      const candidates = events.sort(() => Math.random() - 0.5).slice(0, 5);
      for (const event of candidates) {
        const comp = event.competitions?.[0];
        if (!comp?.competitors) continue;

        // Pick one random team from the match
        const teams = comp.competitors;
        const team = teams[Math.floor(Math.random() * teams.length)];
        const club_name = team.team.displayName;
        const logoUrl = team.team.logo || (team.team.logos?.[0]?.href);

        if (!logoUrl) continue;

        console.log(`[generateGuessClub] Blurring logo for ${club_name}: ${logoUrl}`);
        const imgRes = await axios.get(logoUrl, { responseType: 'arraybuffer', timeout: 10000 });
        const blurredBuffer = await sharp(Buffer.from(imgRes.data))
          .blur(20)
          .toFormat('png')
          .toBuffer();
        const base64 = `data:image/png;base64,${blurredBuffer.toString('base64')}`;

        return {
          game_type: 'guess_club',
          puzzle_data: { logo_data: base64 },
          solution: { secret: club_name }
        };
      }
    } catch (e) {
      console.warn(`[generateGuessClub] Failed league ${league}: ${e.message}`);
    }
  }

  // Hard fallback with known working ESPN logo
  console.error('[generateGuessClub] All leagues failed, using hardcoded fallback');
  try {
    const fallbackUrl = 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png'; // Barcelona
    const imgRes = await axios.get(fallbackUrl, { responseType: 'arraybuffer', timeout: 8000 });
    const blurredBuffer = await sharp(Buffer.from(imgRes.data)).blur(20).toFormat('png').toBuffer();
    return {
      game_type: 'guess_club',
      puzzle_data: { logo_data: `data:image/png;base64,${blurredBuffer.toString('base64')}` },
      solution: { secret: 'Barcelona' }
    };
  } catch (e2) {
    return {
      game_type: 'guess_club',
      puzzle_data: { logo_data: 'https://a.espncdn.com/i/teamlogos/soccer/500/86.png' },
      solution: { secret: 'Barcelona' }
    };
  }
}


// ── saveMiniGame ──────────────────────────────────────────────────────────────

async function saveMiniGame(game) {
  const query = `
    INSERT INTO daily_mini_games (game_type, play_date, puzzle_data, solution)
    VALUES ($1, CURRENT_DATE, $2, $3)
    ON CONFLICT (game_type, play_date) DO UPDATE SET
      puzzle_data = EXCLUDED.puzzle_data,
      solution = EXCLUDED.solution
  `;
  try {
    await pool.query(query, [game.game_type, game.puzzle_data, game.solution]);
    console.log(`[generateMiniGames] Saved/Updated ${game.game_type} for today.`);
  } catch (err) {
    console.error(`[generateMiniGames] Error saving ${game.game_type}:`, err.message);
    throw err;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function generateAllMiniGames() {
  console.log('[generateMiniGames] Starting daily mini games generation...');
  const results = { success: [], failed: [] };

  const generators = [
    { name: 'missing_xi',  fn: generateMissingXI },
    { name: 'who_are_ya',  fn: generateWhoAreYa },
    { name: 'career_path', fn: generateCareerPath },
    { name: 'box2box',     fn: generateBox2Box },
    { name: 'guess_club',  fn: generateGuessClub },
  ];

  for (const gen of generators) {
    try {
      console.log(`[generateMiniGames] Generating ${gen.name}...`);
      const game = await gen.fn();
      await saveMiniGame(game);
      results.success.push(gen.name);
    } catch (error) {
      console.error(`[generateMiniGames] Failed to generate ${gen.name}:`, error.stack || error.message);
      results.failed.push(gen.name);
    }
  }

  console.log(`[generateMiniGames] Complete. Success: [${results.success.join(', ')}]  Failed: [${results.failed.join(', ')}]`);
}

module.exports = { generateAllMiniGames };
