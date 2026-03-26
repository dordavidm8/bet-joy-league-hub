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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomSleep = async () => {
  const delay = Math.floor(Math.random() * 2000) + 3000;
  console.log(`[generateMiniGames] Sleeping ${delay}ms...`);
  await sleep(delay);
};

const axiosConfig = (url) => {
  const domain = new URL(url).hostname;
  return {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': `https://${domain}/`,
      'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    timeout: 10000
  };
};

async function fetchHtml(url) {
  // Wait a bit longer and more randomly to avoid being flagged
  const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
  console.log(`[generateMiniGames] Fetching ${url}... (delay ${delay}ms)`);
  await sleep(delay);
  
  const res = await axios.get(url, axiosConfig(url));
  return cheerio.load(res.data);
}

const KNOWN_PLAYERS = [
  { id: 'd70ce98e', name: 'Lionel Messi' },
  { id: 'dea698d9', name: 'Cristiano Ronaldo' },
  { id: 'e46012d4', name: 'Kevin De Bruyne' },
  { id: '1f44ac21', name: 'Erling Haaland' },
  { id: '69233f98', name: 'Neymar' },
  { id: '438b3a51', name: 'Kylian Mbappe' },
  { id: '0972cb76', name: 'Robert Lewandowski' }
];

const HISTORICAL_MATCHES = [
  { id: 'c9e9008d', slug: 'Real-Madrid-Atletico-Madrid-May-24-2014-Champions-League' },
  { id: '47d0e808', slug: 'Liverpool-Tottenham-Hotspur-June-1-2019-Champions-League' },
  { id: '3da31e77', slug: 'Barcelona-Juventus-June-6-2015-Champions-League' },
  { id: 'e86ee094', slug: 'Real-Madrid-Liverpool-May-26-2018-Champions-League' }
];

async function ensurePlayerClub(player_name, club_name) {
  try {
     await pool.query('INSERT INTO player_clubs (player_name, club_name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [player_name, club_name]);
  } catch(e) { } // ignore
}

async function generateCareerPath() {
  const players = [
    'Cristiano_Ronaldo', 'Lionel_Messi', 'Zlatan_Ibrahimović', 
    'Robert_Lewandowski', 'Luka_Modrić', 'Karim_Benzema', 'Erling_Haaland'
  ];
  const playerName = players[Math.floor(Math.random() * players.length)];
  const url = `https://en.wikipedia.org/wiki/${playerName}`;
  
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
            const clubSlug = club.toLowerCase().replace(/[`']/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            // Using clearbit as a better fallback than fastly
            const clubLogo = `https://logo.clearbit.com/${clubSlug.replace(/-/g, '')}.com?size=100`;
            
            transfers.push({ 
              season: yearText, 
              club, 
              clubLogo,
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
    solution: { secret: playerName.replace(/_/g, ' ') }
  };
}

const ESPN_LEAGUES = ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'uefa.champions'];

async function fetchEspnMatch(league, eventId) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`;
  console.log(`[generateMiniGames] Fetching ESPN match: ${url}`);
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

async function generateMissingXI() {
  const verifiedMatches = [
    { league: 'eng.1', id: '671404' }, // Man City vs West Ham
    { league: 'eng.1', id: '671405' }, // Arsenal vs Everton
    { league: 'eng.1', id: '671406' }, // Liverpool vs Wolves
    { league: 'eng.1', id: '671413' }  // Chelsea vs Bournemouth
  ];

  let starters = [];
  let teamName = '';
  let teamLogo = '';
  
  // Shuffle and try them all until one works
  const shuffled = [...verifiedMatches].sort(() => Math.random() - 0.5);

  for (const match of shuffled) {
    console.log(`[generateMissingXI] Attempting verified match ${match.id} in ${match.league}...`);
    try {
      const data = await fetchEspnMatch(match.league, match.id);
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

        if (starters.length >= 11) break; 
      }
    } catch (e) {
      console.warn(`[generateMissingXI] Failed match ${match.id}: ${e.message}`);
    }
  }

  if (starters.length < 11) {
    throw new Error(`Could not find a match with rosters in any verified match.`);
  }

  const formation = "4-3-3"; 
  const hiddenIdx = Math.floor(Math.random() * 10) + 1;
  const hiddenPlayerName = starters[hiddenIdx].name;
  
  // Clean players array for puzzle (mask name)
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

async function generateWhoAreYa() {
  const players = ['Kylian_Mbappé', 'Vinícius_Júnior', 'Kevin_De_Bruyne', 'Mohamed_Salah', 'Erling_Haaland'];
  const playerName = players[Math.floor(Math.random() * players.length)];
  const url = `https://en.wikipedia.org/wiki/${playerName}`;
  
  console.log(`[generateMiniGames] Fetching Wikipedia player: ${url}`);
  const res = await axios.get(url, axiosConfig(url));
  const $ = cheerio.load(res.data);

  const infobox = $('.infobox').first();
  
  const getInfoboxData = (label) => {
    const row = infobox.find('tr').filter((i, el) => $(el).text().toLowerCase().includes(label.toLowerCase()));
    const data = row.find('.infobox-data').text().trim() || row.find('td').text().trim();
    return data;
  };

  let image_url = infobox.find('.infobox-image img').attr('src');
  if (image_url && !image_url.startsWith('http')) {
    image_url = 'https:' + image_url;
  }

  let nationality = getInfoboxData('National team') || getInfoboxData('Nationalité') || '';
  if (!nationality || /\d{4}/.test(nationality)) {
      const birthRow = infobox.find('tr').filter((i, el) => $(el).text().includes('Place of birth'));
      nationality = birthRow.find('a').last().text().trim() || 'World';
  }

  const club = getInfoboxData('Current team') || 'Liverpool';
  const position = getInfoboxData('Position') || 'Forward';

  return {
    game_type: 'who_are_ya',
    puzzle_data: {
      image_url,
      nationality: nationality.replace(/\[\d+\]/g, '').split(/[()]/)[0].split(',').pop().trim(),
      club: club.replace(/\[\d+\]/g, '').trim(),
      position: position.split(',')[0].trim(),
      age: 26 
    },
    solution: { secret: playerName.replace(/_/g, ' ') }
  };
}

async function generateBox2Box() {
  const query = `
    SELECT c1.club_name AS team1, c2.club_name AS team2
    FROM player_clubs c1
    JOIN player_clubs c2 ON c1.player_name = c2.player_name AND c1.club_name < c2.club_name
    GROUP BY c1.club_name, c2.club_name
    HAVING COUNT(DISTINCT c1.player_name) >= 1
    ORDER BY RANDOM()
    LIMIT 1;
  `;
  const { rows } = await pool.query(query);
  let team1 = 'Real Madrid', team2 = 'Juventus', solutionInfo = 'Cristiano Ronaldo';
  if (rows.length > 0) {
    team1 = rows[0].team1;
    team2 = rows[0].team2;
    // Find who played in both
    const playerQuery = `
      SELECT c1.player_name 
      FROM player_clubs c1 
      JOIN player_clubs c2 ON c1.player_name=c2.player_name 
      WHERE c1.club_name=$1 AND c2.club_name=$2 
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

async function generateGuessClub() {
  try {
    const verifiedMatches = [
      { league: 'eng.1', id: '671413' }, { league: 'eng.1', id: '671404' },
      { league: 'esp.1', id: '674034' }, { league: 'ger.1', id: '675845' }
    ];
    const match = verifiedMatches[Math.floor(Math.random() * verifiedMatches.length)];
    const data = await fetchEspnMatch(match.league, match.id);
    
    if (data.rosters && data.rosters.length > 0) {
      const roster = data.rosters[Math.floor(Math.random() * data.rosters.length)];
      const club_name = roster.team.displayName;
      const logoUrl = roster.team.logo || (roster.team.logos && roster.team.logos[0]?.href);

      if (logoUrl) {
        const imgRes = await axios.get(logoUrl, { responseType: 'arraybuffer' });
        const blurredBuffer = await sharp(imgRes.data).blur(30).toBuffer();
        const base64 = `data:image/png;base64,${blurredBuffer.toString('base64')}`;

        return {
          game_type: 'guess_club',
          puzzle_data: { logo_data: base64 },
          solution: { secret: club_name }
        };
      }
    }
  } catch(e) { console.error('[generateGuessClub] error:', e.message); }

  return {
    game_type: 'guess_club',
    puzzle_data: { logo_data: 'https://placehold.co/100x100?text=GuessTheClub' },
    solution: { secret: 'Real Madrid' }
  };
}

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
    console.log(`[generateMiniGames] Saved/Updated ${game.game_type} in DB.`);
  } catch (err) {
    console.error(`[generateMiniGames] Error saving ${game.game_type}:`, err.message);
    throw err;
  }
}

async function generateAllMiniGames() {
  console.log('[generateMiniGames] Starting daily mini games generation part 2...');
  try {
    const games = [];
    games.push(await generateMissingXI());
    games.push(await generateWhoAreYa());
    games.push(await generateCareerPath());
    games.push(await generateBox2Box());
    games.push(await generateGuessClub());

    for (const game of games) {
      await saveMiniGame(game);
    }
    
    console.log('[generateMiniGames] Complete.');
  } catch (error) {
    console.error('[generateMiniGames] Error:', error.stack || error.message);
  }
}

module.exports = { generateAllMiniGames };
