/**
 * teamNames.js – תרגום שמות קבוצות (backend)
 *
 * translateTeam(name, approvedDynamic) – תרגום עם fallback לתרגומים מה-DB
 * isKnownTeam(name)                   – האם הקבוצה מוכרת במפה הסטטית
 * llmTranslateTeam(nameEn)            – תרגום דרך Groq LLM לקבוצות חדשות
 * queueUnknownTeams(pool, names)      – שומר קבוצות לא-מוכרות ב-DB + מתרגם async
 */
const TEAM_NAMES_HE = {
  "Algeria": "אלג'יריה",
  "Argentina": "ארגנטינה",
  "Australia": "אוסטרליה",
  "Austria": "אוסטריה",
  "Belgium": "בלגיה",
  "Bolivia": "בוליביה",
  "Bosnia and Herzegovina": "בוסניה",
  "Bosnia-Herzegovina": "בוסניה",
  "Brazil": "ברזיל",
  "Canada": "קנדה",
  "Cape Verde": "כף ורדה",
  "Chile": "צ'ילה",
  "Colombia": "קולומביה",
  "Congo DR": "קונגו",
  "DR Congo": "קונגו",
  "Costa Rica": "קוסטה ריקה",
  "Croatia": "קרואטיה",
  "Curacao": "קוראסאו",
  "Curaçao": "קוראסאו",
  "Czech Republic": "צ'כיה",
  "Czechia": "צ'כיה",
  "Denmark": "דנמרק",
  "Ecuador": "אקוודור",
  "Egypt": "מצרים",
  "El Salvador": "אל סלוודור",
  "England": "אנגליה",
  "Finland": "פינלנד",
  "France": "צרפת",
  "Germany": "גרמניה",
  "Ghana": "גאנה",
  "Greece": "יוון",
  "Guatemala": "גואטמלה",
  "Haiti": "האיטי",
  "Honduras": "הונדורס",
  "Hungary": "הונגריה",
  "Iceland": "איסלנד",
  "Iran": "איראן",
  "Iraq": "עיראק",
  "Ireland": "אירלנד",
  "Republic of Ireland": "אירלנד",
  "Northern Ireland": "צפון אירלנד",
  "Ivory Coast": "חוף השנהב",
  "Cote d'Ivoire": "חוף השנהב",
  "Côte d'Ivoire": "חוף השנהב",
  "Jamaica": "ג'מייקה",
  "Japan": "יפן",
  "Jordan": "ירדן",
  "Kenya": "קניה",
  "South Korea": "דרום קוריאה",
  "Korea Republic": "דרום קוריאה",
  "Mali": "מאלי",
  "Mexico": "מקסיקו",
  "Morocco": "מרוקו",
  "Netherlands": "הולנד",
  "New Zealand": "ניו זילנד",
  "Nigeria": "ניגריה",
  "North Macedonia": "מקדוניה",
  "Norway": "נורווגיה",
  "Panama": "פנמה",
  "Paraguay": "פרגוואי",
  "Peru": "פרו",
  "Poland": "פולין",
  "Portugal": "פורטוגל",
  "Qatar": "קטאר",
  "Romania": "רומניה",
  "Russia": "רוסיה",
  "Saudi Arabia": "ערב הסעודית",
  "Scotland": "סקוטלנד",
  "Senegal": "סנגל",
  "Serbia": "סרביה",
  "Slovakia": "סלובקיה",
  "Slovenia": "סלובניה",
  "South Africa": "דרום אפריקה",
  "Spain": "ספרד",
  "Sweden": "שבדיה",
  "Switzerland": "שווייץ",
  "Trinidad and Tobago": "טרינידד וטובגו",
  "Tunisia": "תוניסיה",
  "Turkey": "טורקיה",
  "Türkiye": "טורקיה",
  "Ukraine": "אוקראינה",
  "United States": "ארה\"ב",
  "USA": "ארה\"ב",
  "Uruguay": "אורוגוואי",
  "Uzbekistan": "אוזבקיסטן",
  "Venezuela": "ונצואלה",
  "Wales": "ויילס",

  "Real Madrid": "ריאל מדריד",
  "Barcelona": "ברצלונה",
  "FC Barcelona": "ברצלונה",
  "Atletico Madrid": "אתלטיקו מדריד",
  "Atlético Madrid": "אתלטיקו מדריד",
  "Bayern Munich": "באיירן מינכן",
  "FC Bayern Munich": "באיירן מינכן",
  "Manchester City": "מנצ'סטר סיטי",
  "Liverpool": "ליברפול",
  "Chelsea": "צ'לסי",
  "Arsenal": "ארסנל",
  "Manchester United": "מנצ'סטר יונייטד",
  "Manchester Utd": "מנצ'סטר יונייטד",
  "Man Utd": "מנצ'סטר יונייטד",
  "Tottenham Hotspur": "טוטנהאם",
  "Tottenham": "טוטנהאם",
  "Spurs": "טוטנהאם",
  "Paris Saint-Germain": "פ.ס.ז'",
  "Paris Saint Germain": "פ.ס.ז'",
  "PSG": "פ.ס.ז'",
  "Juventus": "יובנטוס",
  "Inter Milan": "אינטר",
  "Inter": "אינטר",
  "AC Milan": "מילאן",
  "Milan": "מילאן",
  "Borussia Dortmund": "בורוסיה דורטמונד",
  "RB Leipzig": "לייפציג",
  "Bayer Leverkusen": "באייר לברקוזן",
  "Eintracht Frankfurt": "איינטרכט פרנקפורט",
  "Benfica": "בנפיקה",
  "SL Benfica": "בנפיקה",
  "Porto": "פורטו",
  "FC Porto": "פורטו",
  "Sporting CP": "ספורטינג",
  "Ajax": "אייאקס",
  "AFC Ajax": "אייאקס",
  "PSV Eindhoven": "פ.ס.ו.",
  "PSV": "פ.ס.ו.",
  "Feyenoord": "פיינורד",
  "Napoli": "נאפולי",
  "Roma": "רומא",
  "AS Roma": "רומא",
  "Lazio": "לאציו",
  "SS Lazio": "לאציו",
  "Atalanta": "אטלנטה",
  "Celtic": "סלטיק",
  "Rangers": "ריינג'רס",
  "Galatasaray": "גלטסראי",
  "Fenerbahce": "פנרבחה",
  "Club Brugge": "קלוב ברוז'",
  "Dinamo Zagreb": "דינמו זאגרב",
  "Red Bull Salzburg": "זלצבורג",
  "FC Red Bull Salzburg": "זלצבורג",
  "RB Salzburg": "זלצבורג",
  "Shakhtar Donetsk": "שחטר דונצק",
  "Monaco": "מונקו",
  "AS Monaco": "מונקו",
  "Lille": "ליל",
  "LOSC Lille": "ליל",
  "Lyon": "ליון",
  "Olympique Lyonnais": "ליון",
  "Marseille": "מרסיי",
  "Olympique de Marseille": "מרסיי",
  "Nice": "ניס",
  "OGC Nice": "ניס",
  "Aston Villa": "אסטון וילה",
  "Newcastle United": "ניוקאסל",
  "Newcastle Utd": "ניוקאסל",
  "Newcastle": "ניוקאסל",
  "Sunderland": "סנדרלנד",

  "Bournemouth": "בורנמות'",
  "AFC Bournemouth": "בורנמות'",
  "Brentford": "ברנטפורד",
  "Brighton & Hove Albion": "ברייטון",
  "Brighton": "ברייטון",
  "Burnley": "ברנלי",
  "Elche": "אלצ'ה",
  "Crystal Palace": "קריסטל פאלאס",
  "Everton": "אברטון",
  "Fulham": "פולהאם",
  "Luton Town": "לוטון",
  "Nottingham Forest": "נוטינגהאם פורסט",
  "Nottm Forest": "נוטינגהאם פורסט",
  "Sheffield United": "שפילד יונייטד",
  "Sheffield Utd": "שפילד יונייטד",
  "Sheff Utd": "שפילד יונייטד",
  "West Ham United": "ווסט האם",
  "West Ham": "ווסט האם",
  "West Ham Utd": "ווסט האם",
  "Wolverhampton Wanderers": "וולבס",
  "Wolverhampton": "וולבס",
  "Wolves": "וולבס",
  "Leicester City": "לסטר סיטי",
  "Leicester": "לסטר סיטי",
  "Leeds United": "לידס יונייטד",
  "Leeds": "לידס יונייטד",
  "Southampton": "סאות'המפטון",
  "Ipswich Town": "איפסוויץ'",
  "Ipswich": "איפסוויץ'",

  "Sevilla": "סביליה",
  "Sevilla FC": "סביליה",
  "Real Betis": "ריאל בטיס",
  "Valencia": "ולנסיה",
  "Valencia CF": "ולנסיה",
  "Villarreal": "ויאריאל",
  "Villarreal CF": "ויאריאל",
  "Real Sociedad": "ריאל סוסיידד",
  "Athletic Bilbao": "אתלטיק בילבאו",
  "Athletic Club": "אתלטיק בילבאו",
  "Osasuna": "אוסאסונה",
  "CA Osasuna": "אוסאסונה",
  "Rayo Vallecano": "ראיו ויאקנו",
  "Celta Vigo": "סלטה ויגו",
  "Espanyol": "אספניול",
  "RCD Espanyol": "אספניול",
  "Getafe": "חטאפה",
  "Getafe CF": "חטאפה",
  "Girona": "ז'ירונה",
  "Girona FC": "ז'ירונה",
  "Alaves": "אלאבס",
  "Deportivo Alaves": "אלאבס",
  "Las Palmas": "לאס פלמאס",
  "UD Las Palmas": "לאס פלמאס",
  "Mallorca": "מיורקה",
  "RCD Mallorca": "מיורקה",
  "Real Mallorca": "מיורקה",
  "Leganes": "לגאנס",
  "CD Leganes": "לגאנס",
  "Valladolid": "ויאדוליד",
  "Real Valladolid": "ויאדוליד",
  "Granada": "גרנדה",
  "Cadiz": "קאדיס",

  "Borussia Monchengladbach": "בורוסיה מנכנגלדבך",
  "Borussia Mönchengladbach": "בורוסיה מנכנגלדבך",
  "Wolfsburg": "וולפסבורג",
  "VfL Wolfsburg": "וולפסבורג",
  "Stuttgart": "שטוטגרט",
  "VfB Stuttgart": "שטוטגרט",
  "Hoffenheim": "הופנהיים",
  "TSG Hoffenheim": "הופנהיים",
  "1899 Hoffenheim": "הופנהיים",
  "Freiburg": "פרייבורג",
  "SC Freiburg": "פרייבורג",
  "Werder Bremen": "ורדר ברמן",
  "SV Werder Bremen": "ורדר ברמן",
  "Union Berlin": "יוניון ברלין",
  "FC Union Berlin": "יוניון ברלין",
  "1. FC Union Berlin": "יוניון ברלין",
  "Hertha Berlin": "הרתה ברלין",
  "Hertha BSC": "הרתה ברלין",
  "Cologne": "קלן",
  "FC Cologne": "קלן",
  "1. FC Köln": "קלן",
  "Augsburg": "אאוגסבורג",
  "FC Augsburg": "אאוגסבורג",
  "Mainz": "מיינץ",
  "Mainz 05": "מיינץ",
  "FSV Mainz 05": "מיינץ",
  "1. FSV Mainz 05": "מיינץ",
  "Bochum": "בוכום",
  "VfL Bochum": "בוכום",
  "Darmstadt": "דארמשטט",
  "SV Darmstadt 98": "דארמשטט",
  "Heidenheim": "היידנהיים",
  "FC Heidenheim": "היידנהיים",
  "1. FC Heidenheim 1846": "היידנהיים",
  "Hamburg": "המבורג",
  "Hamburger SV": "המבורג",
  "St. Pauli": "סנט פאולי",
  "FC St. Pauli": "סנט פאולי",
  "Holstein Kiel": "קיל",

  "Fiorentina": "פיורנטינה",
  "ACF Fiorentina": "פיורנטינה",
  "Torino": "טורינו",
  "Torino FC": "טורינו",
  "Bologna": "בולוניה",
  "Bologna FC": "בולוניה",
  "Sassuolo": "ססואולו",
  "US Sassuolo": "ססואולו",
  "Monza": "מונזה",
  "AC Monza": "מונזה",
  "Hellas Verona": "ורונה",
  "Verona": "ורונה",
  "Udinese": "אודינזה",
  "Cagliari": "קאלייארי",
  "Cagliari Calcio": "קאלייארי",
  "Frosinone": "פרוזינונה",
  "Salernitana": "סלרניטאנה",
  "US Salernitana": "סלרניטאנה",
  "Lecce": "לצ'ה",
  "US Lecce": "לצ'ה",
  "Empoli": "אמפולי",
  "FC Empoli": "אמפולי",
  "Genoa": "ג'נואה",
  "Genoa CFC": "ג'נואה",
  "Venezia": "ונציה",
  "Venezia FC": "ונציה",
  "Como": "קומו",
  "Como 1907": "קומו",
  "Parma": "פארמה",
  "Parma Calcio": "פארמה",

  "Lens": "לאנס",
  "RC Lens": "לאנס",
  "Strasbourg": "שטרסבורג",
  "RC Strasbourg": "שטרסבורג",
  "Rennes": "רן",
  "Stade Rennais": "רן",
  "Lorient": "לוריאן",
  "Nantes": "נאנט",
  "FC Nantes": "נאנט",
  "Reims": "ריים",
  "Stade de Reims": "ריים",
  "Montpellier": "מונפליה",
  "Toulouse": "טולוז",
  "Toulouse FC": "טולוז",
  "Brest": "ברסט",
  "Stade Brestois": "ברסט",
  "Le Havre": "לה אבר",
  "Le Havre AC": "לה אבר",
  "Metz": "מץ",
  "FC Metz": "מץ",
  "Clermont": "קלרמון",
  "Clermont Foot": "קלרמון",
  "Auxerre": "אוקסר",
  "AJ Auxerre": "אוקסר",
  "Angers": "אנז'ה",
  "SCO Angers": "אנז'ה",
  "Saint-Etienne": "סן אטיין",
  "AS Saint-Etienne": "סן אטיין",
  "Nimes": "נים",
  "Nîmes Olympique": "נים",
  "Bordeaux": "בורדו",
};

function translateTeam(name, approvedDynamic = {}) {
  if (!name) return name;
  if (approvedDynamic[name]) return approvedDynamic[name];
  if (TEAM_NAMES_HE[name]) return TEAM_NAMES_HE[name];
  const lower = name.toLowerCase();
  const found = Object.keys(approvedDynamic).find((k) => k.toLowerCase() === lower)
    ?? Object.keys(TEAM_NAMES_HE).find((k) => k.toLowerCase() === lower);
  if (found) return approvedDynamic[found] ?? TEAM_NAMES_HE[found];
  return name;
}

function isKnownTeam(name) {
  if (!name) return true;
  if (TEAM_NAMES_HE[name]) return true;
  const lower = name.toLowerCase();
  return Object.keys(TEAM_NAMES_HE).some((k) => k.toLowerCase() === lower);
}

// Ask Groq for a Hebrew translation of an unknown English team name
async function llmTranslateTeam(nameEn) {
  try {
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const resp = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      max_tokens: 30,
      messages: [
        {
          role: 'system',
          content: 'אתה מומחה כדורגל ישראלי. תרגם שם קבוצה/נבחרת מאנגלית לעברית כפי שמשתמשים בה בישראל. החזר רק את השם בעברית, ללא כל טקסט נוסף.',
        },
        { role: 'user', content: nameEn },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[teamNames] Groq translation failed for', nameEn, err.message);
    return null;
  }
}

// Queue unknown team names: insert to DB as pending + call LLM (fire-and-forget)
async function queueUnknownTeams(pool, names) {
  const unknown = names.filter((n) => n && !isKnownTeam(n));
  if (!unknown.length) return;

  for (const nameEn of unknown) {
    try {
      const existing = await pool.query(
        `SELECT name_en FROM team_name_translations WHERE name_en = $1`, [nameEn]
      );
      if (existing.rows.length > 0) continue;

      // Save as pending immediately (without waiting for LLM)
      await pool.query(
        `INSERT INTO team_name_translations (name_en, name_he, status) VALUES ($1, NULL, 'pending') ON CONFLICT DO NOTHING`,
        [nameEn]
      );

      // Translate via Groq async (don't await)
      llmTranslateTeam(nameEn).then(async (nameHe) => {
        if (!nameHe) return;
        await pool.query(
          `UPDATE team_name_translations SET name_he = $1 WHERE name_en = $2`,
          [nameHe, nameEn]
        );
        console.log(`[teamNames] LLM translated "${nameEn}" → "${nameHe}"`);
      }).catch(() => {});
    } catch (err) {
      console.error('[teamNames] queueUnknownTeams error:', err.message);
    }
  }
}

module.exports = { translateTeam, isKnownTeam, queueUnknownTeams, TEAM_NAMES_HE };
