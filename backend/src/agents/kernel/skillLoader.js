const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../skills');

const yaml = require('js-yaml');

/**
 * Parses simple YAML frontmatter.
 * Expects format:
 * ---
 * key: value
 * list: [item1, item2]
 * ---
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { metadata: {}, body: content };

  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();
  let metadata = {};

  try {
    metadata = yaml.load(yamlStr) || {};
  } catch (err) {
    console.error('Failed to parse YAML frontmatter:', err);
  }

  return { metadata, body };
}

/**
 * Loads all skills from the agents/skills directory.
 * Reads SKILL.md and injects references/*.md
 */
async function loadAllSkills() {
  const skills = [];
  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const dir of dirs) {
    const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      const content = fs.readFileSync(skillPath, 'utf8');
      const { metadata, body } = parseFrontmatter(content);
      
      const skill = {
        name: metadata.name || dir,
        description: metadata.description || '',
        role: metadata.metadata?.role || metadata.role || 'Agent',
        title: metadata.metadata?.title || metadata.title || dir,
        avatar: metadata.metadata?.avatar || metadata.avatar || '🤖',
        tools: metadata.metadata?.tools || metadata.tools || [],
        instructions: body,
        references: {}
      };

      // Load references
      const refPath = path.join(SKILLS_DIR, dir, 'references');
      if (fs.existsSync(refPath)) {
        const refFiles = fs.readdirSync(refPath).filter(f => f.endsWith('.md'));
        for (const rf of refFiles) {
          const refContent = fs.readFileSync(path.join(refPath, rf), 'utf8');
          skill.references[rf] = refContent;
        }
      }

      skills.push(skill);
    }
  }

  return skills;
}

module.exports = {
  loadAllSkills,
  parseFrontmatter
};
