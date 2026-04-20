// English → Hebrew team name translations
// Covers: FIFA World Cup, UEFA Champions League, Premier League, La Liga, Bundesliga, Serie A, Ligue 1
// ESPN displayName variants are included as separate keys

const TEAM_NAMES_HE: Record<string, string> = {
  // ── World Cup national teams ──────────────────────────────────────────────
  'Algeria': 'אלג\'יריה',
  'Argentina': 'ארגנטינה',
  'Australia': 'אוסטרליה',
  'Austria': 'אוסטריה',
  'Belgium': 'בלגיה',
  'Bolivia': 'בוליביה',
  'Bosnia and Herzegovina': 'בוסניה',
  'Bosnia-Herzegovina': 'בוסניה',
  'Brazil': 'ברזיל',
  'Canada': 'קנדה',
  'Cape Verde': 'כף ורדה',
  'Chile': 'צ\'ילה',
  'Colombia': 'קולומביה',
  'Congo DR': 'קונגו',
  'DR Congo': 'קונגו',
  'Costa Rica': 'קוסטה ריקה',
  'Croatia': 'קרואטיה',
  'Curacao': 'קוראסאו',
  'Curaçao': 'קוראסאו',
  'Czech Republic': 'צ\'כיה',
  'Czechia': 'צ\'כיה',
  'Denmark': 'דנמרק',
  'Ecuador': 'אקוודור',
  'Egypt': 'מצרים',
  'El Salvador': 'אל סלבדור',
  'England': 'אנגליה',
  'Finland': 'פינלנד',
  'France': 'צרפת',
  'Germany': 'גרמניה',
  'Ghana': 'גאנה',
  'Greece': 'יוון',
  'Guatemala': 'גואטמלה',
  'Haiti': 'האיטי',
  'Honduras': 'הונדורס',
  'Hungary': 'הונגריה',
  'Iceland': 'איסלנד',
  'Iran': 'איראן',
  'Iraq': 'עיראק',
  'Ireland': 'אירלנד',
  'Republic of Ireland': 'אירלנד',
  'Northern Ireland': 'צפון אירלנד',
  'Ivory Coast': 'חוף השנהב',
  "Cote d'Ivoire": 'חוף השנהב',
  "Côte d'Ivoire": 'חוף השנהב',
  'Jamaica': 'ג\'מייקה',
  'Japan': 'יפן',
  'Jordan': 'ירדן',
  'Kenya': 'קניה',
  'South Korea': 'דרום קוריאה',
  'Korea Republic': 'דרום קוריאה',
  'Mali': 'מאלי',
  'Mexico': 'מקסיקו',
  'Morocco': 'מרוקו',
  'Netherlands': 'הולנד',
  'New Zealand': 'ניו זילנד',
  'Nigeria': 'ניגריה',
  'North Macedonia': 'מקדוניה',
  'Norway': 'נורווגיה',
  'Panama': 'פנמה',
  'Paraguay': 'פרגוואי',
  'Peru': 'פרו',
  'Poland': 'פולין',
  'Portugal': 'פורטוגל',
  'Qatar': 'קטאר',
  'Romania': 'רומניה',
  'Russia': 'רוסיה',
  'Saudi Arabia': 'ערב הסעודית',
  'Scotland': 'סקוטלנד',
  'Senegal': 'סנגל',
  'Serbia': 'סרביה',
  'Slovakia': 'סלובקיה',
  'Slovenia': 'סלובניה',
  'South Africa': 'דרום אפריקה',
  'Spain': 'ספרד',
  'Sweden': 'שבדיה',
  'Switzerland': 'שווייץ',
  'Trinidad and Tobago': 'טרינידד וטובגו',
  'Tunisia': 'תוניסיה',
  'Turkey': 'טורקיה',
  'Türkiye': 'טורקיה',
  'Ukraine': 'אוקראינה',
  'United States': 'ארה"ב',
  'USA': 'ארה"ב',
  'Uruguay': 'אורוגוואי',
  'Uzbekistan': 'אוזבקיסטן',
  'Venezuela': 'ונצואלה',
  'Wales': 'ווילס',

  // ── Champions League / major clubs ───────────────────────────────────────
  'Real Madrid': 'ריאל מדריד',
  'Barcelona': 'ברצלונה',
  'FC Barcelona': 'ברצלונה',
  'Atletico Madrid': 'אתלטיקו מדריד',
  'Atlético Madrid': 'אתלטיקו מדריד',
  'Bayern Munich': 'באיירן מינכן',
  'FC Bayern Munich': 'באיירן מינכן',
  'Manchester City': 'מנצ\'סטר סיטי',
  'Liverpool': 'ליברפול',
  'Chelsea': 'צ\'לסי',
  'Arsenal': 'ארסנל',
  'Manchester United': 'מנצ\'סטר יונייטד',
  'Tottenham Hotspur': 'טוטנהאם',
  'Paris Saint-Germain': 'פ.ס.ז\'',
  'Paris Saint Germain': 'פ.ס.ז\'',
  'PSG': 'פ.ס.ז\'',
  'Juventus': 'יובנטוס',
  'Inter Milan': 'אינטר',
  'Inter': 'אינטר',
  'AC Milan': 'מילאן',
  'Milan': 'מילאן',
  'Borussia Dortmund': 'בורוסיה דורטמונד',
  'RB Leipzig': 'לייפציג',
  'Bayer Leverkusen': 'באיירן לברקוזן',
  'Eintracht Frankfurt': 'פרנקפורט',
  'Benfica': 'בנפיקה',
  'SL Benfica': 'בנפיקה',
  'Porto': 'פורטו',
  'FC Porto': 'פורטו',
  'Sporting CP': 'ספורטינג',
  'Ajax': 'אייאקס',
  'AFC Ajax': 'אייאקס',
  'PSV Eindhoven': 'פ.ס.ו.',
  'PSV': 'פ.ס.ו.',
  'Feyenoord': 'פיינורד',
  'Napoli': 'נאפולי',
  'Roma': 'רומא',
  'AS Roma': 'רומא',
  'Lazio': 'לאציו',
  'SS Lazio': 'לאציו',
  'Atalanta': 'אטלנטה',
  'Celtic': 'סלטיק',
  'Rangers': 'ריינג\'רס',
  'Galatasaray': 'גלטסראיי',
  'Fenerbahce': 'פנרבחצ׳ה',
  'Club Brugge': 'קלוב ברוז\'',
  'Dinamo Zagreb': 'דינמו זאגרב',
  'Red Bull Salzburg': 'זלצבורג',
  'FC Red Bull Salzburg': 'זלצבורג',
  'RB Salzburg': 'זלצבורג',
  'Shakhtar Donetsk': 'שחטאר דונייצק',
  'Monaco': 'מונקו',
  'AS Monaco': 'מונקו',
  'Lille': 'ליל',
  'LOSC Lille': 'ליל',
  'Lyon': 'ליון',
  'Olympique Lyonnais': 'ליון',
  'Marseille': 'מארסיי',
  'Olympique de Marseille': 'מארסיי',
  'Nice': 'ניס',
  'OGC Nice': 'ניס',
  'Aston Villa': 'אסטון וילה',
  'Newcastle United': 'ניוקאסל',

  // ── Premier League ────────────────────────────────────────────────────────
  'Bournemouth': 'בורנמות\'',
  'AFC Bournemouth': 'בורנמות\'',
  'Brentford': 'ברנטפורד',
  'Brighton & Hove Albion': 'ברייטון',
  'Brighton': 'ברייטון',
  'Burnley': 'ברנלי',
  'Crystal Palace': 'קריסטל פאלאס',
  'Everton': 'אברטון',
  'Fulham': 'פולהאם',
  'Luton Town': 'לוטון',
  'Nottingham Forest': 'נוטינגהאם פורסט',
  'Sheffield United': 'שפילד יונייטד',
  'West Ham United': 'ווסט האם',
  'Wolverhampton Wanderers': 'וולבס',
  'Wolves': 'וולבס',
  'Leicester City': 'לסטר סיטי',
  'Leeds United': 'לידס יונייטד',
  'Southampton': 'סאות\'המפטון',
  'Ipswich Town': 'איפסוויץ\'',

  // ── La Liga ───────────────────────────────────────────────────────────────
  'Sevilla': 'סביליה',
  'Sevilla FC': 'סביליה',
  'Real Betis': 'ריאל בטיס',
  'Valencia': 'ולנסיה',
  'Valencia CF': 'ולנסיה',
  'Villarreal': 'ויאריאל',
  'Villarreal CF': 'ויאריאל',
  'Real Sociedad': 'ריאל סוסיידד',
  'Athletic Bilbao': 'אתלטיק בילבאו',
  'Athletic Club': 'אתלטיק בילבאו',
  'Osasuna': 'אוסאסונה',
  'CA Osasuna': 'אוסאסונה',
  'Rayo Vallecano': 'ראיו ויאקנו',
  'Celta Vigo': 'סלטה ויגו',
  'Espanyol': 'אספניול',
  'RCD Espanyol': 'אספניול',
  'Getafe': 'חטאפה',
  'Getafe CF': 'חטאפה',
  'Girona': 'ג\'ירונה',
  'Girona FC': 'ג\'ירונה',
  'Alaves': 'אלאבס',
  'Deportivo Alaves': 'אלאבס',
  'Las Palmas': 'לאס פאלמאס',
  'UD Las Palmas': 'לאס פאלמאס',
  'Mallorca': 'מאיורקה',
  'RCD Mallorca': 'מאיורקה',
  'Real Mallorca': 'מאיורקה',
  'Leganes': 'לגאנס',
  'CD Leganes': 'לגאנס',
  'Valladolid': 'ויאדוליד',
  'Real Valladolid': 'ויאדוליד',
  'Granada': 'גרנדה',
  'Cadiz': 'קאדיס',

  // ── Bundesliga ────────────────────────────────────────────────────────────
  'Borussia Monchengladbach': 'בורוסיה מנשנגלדבך',
  'Borussia Mönchengladbach': 'בורוסיה מנשנגלדבך',
  'Wolfsburg': 'וולפסבורג',
  'VfL Wolfsburg': 'וולפסבורג',
  'Stuttgart': 'שטוטגרט',
  'VfB Stuttgart': 'שטוטגרט',
  'Hoffenheim': 'הופנהיים',
  'TSG Hoffenheim': 'הופנהיים',
  '1899 Hoffenheim': 'הופנהיים',
  'Freiburg': 'פרייבורג',
  'SC Freiburg': 'פרייבורג',
  'Werder Bremen': 'ורדר ברמן',
  'SV Werder Bremen': 'ורדר ברמן',
  'Union Berlin': 'אוניון ברלין',
  'FC Union Berlin': 'אוניון ברלין',
  '1. FC Union Berlin': 'אוניון ברלין',
  'Hertha Berlin': 'הרטה ברלין',
  'Hertha BSC': 'הרטה ברלין',
  'Cologne': 'קלן',
  'FC Cologne': 'קלן',
  '1. FC Köln': 'קלן',
  'Augsburg': 'אוגסבורג',
  'FC Augsburg': 'אוגסבורג',
  'Mainz': 'מיינץ',
  'Mainz 05': 'מיינץ',
  'FSV Mainz 05': 'מיינץ',
  '1. FSV Mainz 05': 'מיינץ',
  'Bochum': 'בוכום',
  'VfL Bochum': 'בוכום',
  'Darmstadt': 'דארמשטאדט',
  'SV Darmstadt 98': 'דארמשטאדט',
  'Heidenheim': 'היידנהיים',
  'FC Heidenheim': 'היידנהיים',
  '1. FC Heidenheim 1846': 'היידנהיים',
  'Hamburg': 'המבורג',
  'Hamburger SV': 'המבורג',
  'St. Pauli': 'סנט פאולי',
  'FC St. Pauli': 'סנט פאולי',
  'Holstein Kiel': 'קיל',

  // ── Serie A ───────────────────────────────────────────────────────────────
  'Fiorentina': 'פיורנטינה',
  'ACF Fiorentina': 'פיורנטינה',
  'Torino': 'טורינו',
  'Torino FC': 'טורינו',
  'Bologna': 'בולוניה',
  'Bologna FC': 'בולוניה',
  'Sassuolo': 'ססואולו',
  'US Sassuolo': 'ססואולו',
  'Monza': 'מונזה',
  'AC Monza': 'מונזה',
  'Hellas Verona': 'ורונה',
  'Verona': 'ורונה',
  'Udinese': 'אודינזה',
  'Cagliari': 'קאליארי',
  'Cagliari Calcio': 'קאליארי',
  'Frosinone': 'פרוזינונה',
  'Salernitana': 'סלרניטאנה',
  'US Salernitana': 'סלרניטאנה',
  'Lecce': 'לצ\'ה',
  'US Lecce': 'לצ\'ה',
  'Empoli': 'אמפולי',
  'FC Empoli': 'אמפולי',
  'Genoa': 'גנואה',
  'Genoa CFC': 'גנואה',
  'Venezia': 'ונציה',
  'Venezia FC': 'ונציה',
  'Como': 'קומו',
  'Como 1907': 'קומו',
  'Parma': 'פארמה',
  'Parma Calcio': 'פארמה',

  // ── Ligue 1 ───────────────────────────────────────────────────────────────
  'Lens': 'לאנס',
  'RC Lens': 'לאנס',
  'Strasbourg': 'שטרסבורג',
  'RC Strasbourg': 'שטרסבורג',
  'Rennes': 'רן',
  'Stade Rennais': 'רן',
  'Lorient': 'לוריאן',
  'Nantes': 'נאנט',
  'FC Nantes': 'נאנט',
  'Reims': 'ריים',
  'Stade de Reims': 'ריים',
  'Montpellier': 'מונפליה',
  'Toulouse': 'טולוז',
  'Toulouse FC': 'טולוז',
  'Brest': 'ברסט',
  'Stade Brestois': 'ברסט',
  'Le Havre': 'לה האבר',
  'Le Havre AC': 'לה האבר',
  'Metz': 'מץ',
  'FC Metz': 'מץ',
  'Clermont': 'קלרמון',
  'Clermont Foot': 'קלרמון',
  'Auxerre': 'אוקסר',
  'AJ Auxerre': 'אוקסר',
  'Angers': 'אנז\'ה',
  'SCO Angers': 'אנז\'ה',
  'Saint-Etienne': 'סן אטיין',
  'AS Saint-Etienne': 'סן אטיין',
  'Nimes': 'נים',
  'Nîmes Olympique': 'נים',
  'Bordeaux': 'בורדו',
};

// Dynamic translations loaded from DB (approved by admin)
let _dynamic: Record<string, string> = {};
export function setDynamicTranslations(map: Record<string, string>) { _dynamic = map; }

// Lookup: static map → dynamic DB map → original
export function translateTeam(name: string): string {
  if (!name) return name;
  if (TEAM_NAMES_HE[name]) return TEAM_NAMES_HE[name];
  if (_dynamic[name]) return _dynamic[name];
  const lower = name.toLowerCase();
  const found = Object.keys(TEAM_NAMES_HE).find((k) => k.toLowerCase() === lower)
    ?? Object.keys(_dynamic).find((k) => k.toLowerCase() === lower);
  if (found) return (TEAM_NAMES_HE[found] ?? _dynamic[found]);
  return name;
}

// Fixed outcome label translations (handles old English DB records)
const OUTCOME_LABELS_HE: Record<string, string> = {
  'Draw': 'תיקו',
  'Yes': 'כן',
  'No': 'לא',
  'Over 2.5': 'מעל 2.5',
  'Under 2.5': 'מתחת 2.5',
};

export function translateOutcomeLabel(label: string): string {
  return OUTCOME_LABELS_HE[label] ?? translateTeam(label);
}

// Translate old English question_text patterns to Hebrew (handles pre-existing DB records)
export function translateQuestionText(text: string): string {
  if (!text) return text;
  // Fix typos that may exist in already-Hebrew DB records
  text = text.replace(/ישכנסו/g, 'יבקיעו');

  // Handle Hebrew question patterns — backend generates these but team names may still be English
  // (e.g. "מי ינצח: Sunderland נגד Burnley?")
  const heWin = text.match(/^מי ינצח:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heWin) return `מי ינצח: ${translateTeam(heWin[1].trim())} נגד ${translateTeam(heWin[2].trim())}?`;

  const heBtts = text.match(/^שתי הקבוצות יבקיעו גול:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heBtts) return `שתי הקבוצות יבקיעו גול: ${translateTeam(heBtts[1].trim())} נגד ${translateTeam(heBtts[2].trim())}?`;

  const heOu = text.match(/^מעל\/מתחת 2\.5 שערים:\s*(.+?)\s+נגד\s+(.+?)\?$/);
  if (heOu) return `מעל/מתחת 2.5 שערים: ${translateTeam(heOu[1].trim())} נגד ${translateTeam(heOu[2].trim())}?`;

  // Already fully Hebrew (not one of our known patterns)
  if (/[\u0590-\u05FF]/.test(text)) return text;

  // English patterns (old records before Hebrew generation was added)
  const whoWin = text.match(/^Who will win:\s*(.+)\s+vs\s+(.+)\?$/i);
  if (whoWin) return `מי ינצח: ${translateTeam(whoWin[1].trim())} נגד ${translateTeam(whoWin[2].trim())}?`;

  const btts = text.match(/^Both teams to score in\s*(.+)\s+vs\s+(.+)\?$/i);
  if (btts) return `שתי הקבוצות יבקיעו גול: ${translateTeam(btts[1].trim())} נגד ${translateTeam(btts[2].trim())}?`;

  const ou = text.match(/^Over\/Under 2\.5 goals in\s*(.+)\s+vs\s+(.+)\?$/i);
  if (ou) return `מעל/מתחת 2.5 שערים: ${translateTeam(ou[1].trim())} נגד ${translateTeam(ou[2].trim())}?`;

  return text;
}
