-- Rebrand: Kickoff → DerbyUp
-- Updates existing DB rows that were seeded with the old brand name.

UPDATE advisor_config
SET value = 'אתה יועץ הימורי של DerbyUp. ענה תמיד בעברית, בטון חברותי וקצר. אל תמציא סטטיסטיקות.'
WHERE key = 'system_prompt'
  AND value LIKE '%Kickoff%';

UPDATE social_knowledge_base
SET title   = REPLACE(title,   'KickOff', 'DerbyUp'),
    content = REPLACE(content, 'KickOff', 'DerbyUp')
WHERE title LIKE '%KickOff%' OR content LIKE '%KickOff%';
