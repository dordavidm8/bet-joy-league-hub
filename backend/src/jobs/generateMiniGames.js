/**
 * generateMiniGames.js – יצירת חידות יומיות
 *
 * רץ בחצות (00:00 UTC). יוצר 5 חידות, אחת לכל סוג:
 *   MissingXI  – מביא הרכב ממשחק ESPN אחרון
 *   WhoAreYa   – שחקן אקראי מרשימה, מטשטש תמונה (sharp)
 *   CareerPath – קריירת שחקן (מועדונים לפי שנים)
 *   Box2Box    – זוג שחקנים עם היסטוריה משותפת (anti-repeat 30 יום)
 *   GuessClub  – מטשטש לוגו קבוצה ממשחק אחרון
 *
 * שומר puzzle data + solution כ-JSONB ב-daily_mini_games table.
 */
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

// ── Translation helper ────────────────────────────────────────────────────────
async function translateName(name) {
  if (!name) return '';
  const { getGroq } = require('../services/aiAdminService');
  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ 
        role: 'user', 
        content: `Translate the football player/team name "${name}" to Hebrew. Return only the Hebrew name, no other text.` 
      }],
      temperature: 0.1,
      max_tokens: 30,
    });
    return completion.choices[0].message.content.trim().replace(/[".]/g, '');
  } catch (e) {
    console.warn(`[translateName] Failed for ${name}:`, e.message);
    return name;
  }
}

// ── ESPN API helpers ───────────────────────────────────────────────────────────

/**
 * Fetch a list of recently completed matches from ESPN for a given league.
 * Returns an array of { id, name } objects.
 */
async function fetchRecentEspnMatchIds(league) {
  // Generate a random date between 14 days and 3 years ago (approx 1000 days limit)
  const randomDaysBack = Math.floor(Math.random() * 1000) + 14;
  const d = new Date();
  d.setDate(d.getDate() - randomDaysBack);
  
  // Format as YYYYMMDD
  const yyyymmdd = d.toISOString().split('T')[0].replace(/-/g, '');
  
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${yyyymmdd}`;
  console.log(`[generateMiniGames] Fetching randomized past scoreboard for ${league} at date ${yyyymmdd}`);
  const res = await axios.get(url, { timeout: 10000 });
  const events = res.data?.events || [];
  // Keep only STATUS_FINAL matches (completed)
  return events
    .filter(e => e.status?.type?.completed === true)
    .map(e => ({ id: e.id, name: e.name, date: e.date }));
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
  const BIG_CLUBS = [
    'Arsenal', 'Chelsea', 'Liverpool', 'Manchester City', 'Manchester United', 'Tottenham Hotspur',
    'Barcelona', 'Real Madrid', 'Atlético Madrid',
    'Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen',
    'Juventus', 'AC Milan', 'Inter Milan', 'Napoli',
    'Paris Saint-Germain', 'Marseille'
  ];

  let starters = [];
  let teamName = '';
  let teamLogo = '';
  let matchContext = '';

  for (let attempt = 0; attempt < 5; attempt++) {
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

      const shuffled = recentMatches.sort(() => Math.random() - 0.5).slice(0, 5);

      for (const match of shuffled) {
        console.log(`[generateMissingXI] Trying match "${match.name}" (${match.id}) in ${league}...`);
        try {
          const data = await fetchEspnMatch(league, match.id);
          if (data.rosters && data.rosters.length >= 2) {
            const t0 = data.rosters[0].team.displayName;
            const t1 = data.rosters[1].team.displayName;
            const t0Big = BIG_CLUBS.some(c => t0.includes(c) || c.includes(t0));
            const t1Big = BIG_CLUBS.some(c => t1.includes(c) || c.includes(t1));

            if (!t0Big && !t1Big) {
              console.log(`[generateMissingXI] Skipping ${t0} vs ${t1} (Not big clubs)`);
              continue;
            }

            let teamIdx = 0;
            if (t0Big && t1Big) teamIdx = Math.random() < 0.5 ? 0 : 1;
            else if (t1Big) teamIdx = 1;

            const roster = data.rosters[teamIdx];
            const opponentRoster = data.rosters[teamIdx === 0 ? 1 : 0];
            teamName = roster.team.displayName;
            teamLogo = roster.team.logo || (roster.team.logos && roster.team.logos[0]?.href) || '';
            
            let leagueName = league.toUpperCase();
            if (league === 'eng.1') leagueName = 'Premier League';
            else if (league === 'esp.1') leagueName = 'La Liga';
            else if (league === 'ita.1') leagueName = 'Serie A';
            else if (league === 'ger.1') leagueName = 'Bundesliga';

            const dateStr = match.date ? new Date(match.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            matchContext = `טריווית הרכב: שוחק נגד ${opponentRoster.team.displayName} (${leagueName}) ${dateStr ? 'בתאריך ' + dateStr : ''}`;

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
    if (starters.length >= 11) break;
  }

  if (starters.length < 11) {
    throw new Error(`Could not find a match with rosters across all leagues after 5 attempts.`);
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
    puzzle_data: { teamName, teamLogo, matchContext, formation, players: puzzlePlayers, hidden_idx: hiddenIdx },
    solution: { secret: hiddenPlayerName }
  };
}

// ── generateWhoAreYa (LLM Infinite Generation) ────────────────────────────────

async function generateWhoAreYa() {
  const { generateWhoAreYaContext } = require('../services/aiAdminService');
  
  // Avoid repeating the same player
  let recentPlayers = [];
  try {
    const { rows } = await pool.query(`
      SELECT solution->>'secret' AS player
      FROM daily_mini_games
      WHERE game_type = 'who_are_ya'
    `);
    recentPlayers = rows.map(r => r.player).filter(Boolean);
  } catch (e) {
    console.warn('[generateWhoAreYa] Could not fetch recent players:', e.message);
  }

  let player;
  try {
    console.log(`[generateWhoAreYa] Asking Groq for a random famous player...`);
    player = await generateWhoAreYaContext(recentPlayers);
  } catch (err) {
    console.error(`[generateWhoAreYa] LLM Failed. Fallback to Mbappe.`, err);
    player = { name: 'Kylian Mbappé', wikiSlug: 'Kylian_Mbappé', club: 'Real Madrid', nat: 'France', pos: 'Forward' };
  }

  // Try to get the player's photo from Wikipedia
  let image_url = '';
  try {
    const wikiApiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(player.wikiSlug)}&prop=pageimages&format=json&pithumbsize=400`;
    const res = await axios.get(wikiApiUrl, { headers: { 'User-Agent': 'bet-joy-league-hub/1.0 (contact@example.com)' } });
    const pages = res.data?.query?.pages;
    if (pages) {
      const pageInfo = Object.values(pages)[0];
      image_url = pageInfo?.thumbnail?.source || '';
    }

    if (!image_url) {
      const wikiUrl = `https://en.wikipedia.org/wiki/${player.wikiSlug}`;
      const fallbackRes = await axios.get(wikiUrl, axiosConfig(wikiUrl));
      const $ = cheerio.load(fallbackRes.data);
      const infobox = $('.infobox').first();
      let src = infobox.find('.infobox-image img').first().attr('src') || '';
      if (src && !src.startsWith('http')) src = 'https:' + src;
      if (src && src.includes('/')) {
        image_url = src.replace(/\/\d+px-/, '/400px-');
      }
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
  const { generateCareerPathContext } = require('../services/aiAdminService');

  // Avoid repeats
  let recentPlayers = [];
  try {
    const { rows } = await pool.query(`
      SELECT solution->>'secret' AS player
      FROM daily_mini_games
      WHERE game_type = 'career_path'
    `);
    recentPlayers = rows.map(r => r.player).filter(Boolean);
  } catch (e) {}

  let player;
  try {
    console.log(`[generateCareerPath] Asking Groq for a career path player...`);
    player = await generateCareerPathContext(recentPlayers);
  } catch (e) {
    console.error(`[generateCareerPath] LLM fallback`, e);
    player = { name: 'Kevin De Bruyne', wikiSlug: 'Kevin_De_Bruyne' };
  }

  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(player.wikiSlug || player.name.replace(/ /g, '_'))}`;
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

// ── generateBox2Box (with AI and anti-repeat logic) ──────────────────────────────────

async function generateBox2Box() {
  const { generateBox2BoxContext } = require('../services/aiAdminService');

  // Fetch players used in last 365 days to avoid repeats
  let recentPlayers = [];
  try {
    const { rows } = await pool.query(`
      SELECT solution->>'secret' AS player
      FROM daily_mini_games
      WHERE game_type = 'box2box'
      AND play_date >= CURRENT_DATE - INTERVAL '365 days'
    `);
    recentPlayers = rows.map(r => r.player).filter(Boolean);
  } catch (e) {
    console.warn('[generateBox2Box] Could not fetch recent players:', e.message);
  }

  let pair;
  try {
    console.log(`[generateBox2Box] Asking Groq for a box2box pair...`);
    pair = await generateBox2BoxContext(recentPlayers);
  } catch (e) {
    console.error(`[generateBox2Box] LLM fallback`, e);
    pair = { secret_player: 'Cristiano Ronaldo', team1: 'Real Madrid', team2: 'Manchester United' };
  }

  return {
    game_type: 'box2box',
    puzzle_data: { team1: pair.team1, team2: pair.team2 },
    solution: { secret: pair.secret_player }
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
  const { pool } = require('../config/database'); // ensure pool is available
  try {
    const maxDateResult = await pool.query(`SELECT MAX(play_date) as max_date FROM daily_mini_games WHERE game_type = $1`, [game.game_type]);
    let nextDate = new Date();
    // Normalize today to start of day
    nextDate.setHours(0, 0, 0, 0);

    if (maxDateResult.rows[0].max_date) {
      const maxDate = new Date(maxDateResult.rows[0].max_date);
      maxDate.setHours(0, 0, 0, 0);
      if (maxDate >= nextDate) {
        nextDate = new Date(maxDate);
        nextDate.setDate(nextDate.getDate() + 1);
      }
    }

    const query = `
      INSERT INTO daily_mini_games (game_type, play_date, puzzle_data, solution)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (game_type, play_date) DO UPDATE SET
        puzzle_data = EXCLUDED.puzzle_data,
        solution = EXCLUDED.solution
    `;
    const formattedDate = nextDate.toISOString().split('T')[0];
    await pool.query(query, [game.game_type, formattedDate, game.puzzle_data, game.solution]);
    console.log(`[generateMiniGames] Saved ${game.game_type} queued for ${formattedDate}`);
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

async function generateMiniGameDraft(type, options = {}) {
  if (type === 'trivia') {
    const { generateQuizQuestion } = require('../services/aiAdminService');
    const q = await generateQuizQuestion(options);
    return {
      game_type: 'trivia',
      puzzle_data: { question_text: q.question_text, options: q.options },
      solution: { secret: q.correct_option }
    };
  }

  const generators = {
    'missing_xi': generateMissingXI,
    'who_are_ya': generateWhoAreYa,
    'career_path': generateCareerPath,
    'box2box': generateBox2Box,
    'guess_club': generateGuessClub,
  };
  
  if (!generators[type]) throw new Error(`Unknown game type: ${type}`);
  return await generators[type]();
}

module.exports = { generateAllMiniGames, generateMiniGameDraft, saveMiniGame };
