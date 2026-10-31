const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const BUILT_IN_SKILLS = [
  {
    id: 'ponytail',
    name: 'ponytail',
    description: 'Senior lazy developer: maximum efficiency, YAGNI, lowest-rung solutions, pony-tail comments, and non-trivial assert checks.',
    triggers: ['ponytail', 'lazy developer', 'minimal code', 'simplify', 'refactor minimal'],
    enabled: true,
    builtin: true,
    instructions: `You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.
Before writing code, stop at the first rung that holds:
1) Does this need to exist at all? (YAGNI)
2) Stdlib does it? Use it.
3) Native platform feature covers it? Use it.
4) Already-installed dependency solves it? Use it; never add a new one for what a few lines can do.
5) Can it be one line? One line.
6) Only then: minimum code that works.
No unrequested abstractions. Deletion over addition. Boring over clever. Fewest files possible; shortest working diff wins.
Mark deliberate simplifications with a \`// ponytail:\` comment naming the ceiling and upgrade path.
Always leave ONE runnable assert check behind for non-trivial logic.`,
  },
  {
    id: 'smali-master',
    name: 'smali-master',
    description: 'Expert Dalvik Smali bytecode engineering: opcode analysis, register tracking (v0-vN, p0-pN), control flow deobfuscation, and string decryptor patching.',
    triggers: ['smali', 'dalvik', 'bytecode', 'registers', 'opcode', 'patch smali', 'deobfuscate'],
    enabled: true,
    builtin: true,
    instructions: `You are a master Dalvik bytecode engineer.
When analyzing Smali:
1. Pay attention to method signatures (Lpackage/name/Class;->method(I)V) and register allocation (.registers / .locals).
2. Trace const-string, invoke-virtual, iget/iput, and sget/sput instructions.
3. Identify obfuscated string decryption routines (e.g. byte arrays XORed or transformed via custom loops).
4. For patching: provide exact, minimal opcode replacement (e.g., return-void or const/4 v0, 0x1 followed by return v0) without upsetting stack or local registers.
5. Provide before/after diffs in standard Smali syntax.`,
  },
  {
    id: 'security-guard',
    name: 'security-guard',
    description: 'Android reverse engineering security auditor: OWASP Mobile Top 10, CWE flaw detection, hardcoded key hunter, and SSL pinning analysis.',
    triggers: ['audit', 'security', 'vulnerability', 'cwe', 'owasp', 'hardcoded secret', 'crypto', 'ssl pin'],
    enabled: true,
    builtin: true,
    instructions: `You are a senior Android security researcher.
Audit code for:
- Hardcoded credentials: AES keys, JWT tokens, AWS/Firebase/Google API secrets, private certificates.
- Weak cryptography: ECB cipher mode (AES/ECB/PKCS5Padding), MD5/SHA-1 hashing for integrity, static IVs.
- Insecure IPC: exported Activities, Receivers, Services, Content Providers without signature permissions.
- Insecure storage: MODE_WORLD_READABLE, SQLite without cipher, plaintext shared preferences.
- Network flaws: Cleartext HTTP traffic, TrustManager accepting all certs, HostnameVerifier bypasses.
Give clear severity ratings (CRITICAL / HIGH / MEDIUM / LOW), exact line numbers or Smali locations, and remediation snippets.`,
  },
  {
    id: 'frida-hooker',
    name: 'frida-hooker',
    description: 'Frida dynamic instrumentation & Xposed hook generator for runtime tracing, method bypasses, SSL unpinning, and root-detection evasion.',
    triggers: ['frida', 'hook', 'unpinning', 'root bypass', 'xposed', 'dynamic analysis'],
    enabled: true,
    builtin: true,
    instructions: `You generate production-ready Frida JavaScript scripts for Android reverse engineering.
Guidelines:
1. Always wrap with Java.perform(function() { ... }).
2. Use Java.use('full.class.Name') for classes, and overload implementation when targeting specific signatures.
3. Print argument and return values cleanly via console.log with timestamp or tag.
4. For SSL unpinning: provide standard OkHttp3, TrustManager, and NetworkSecurityConfig hooks.
5. Provide a one-line command to run the script: frida -U -f <package.name> -l script.js.`,
  },
];

class SkillManager {
  constructor() {
    this.skillsPath = path.join(app.getPath('userData'), 'skills_catalog.json');
    this.skills = [];
    this.loadSkills();
  }

  loadSkills() {
    try {
      if (fs.existsSync(this.skillsPath)) {
        const raw = fs.readFileSync(this.skillsPath, 'utf8');
        const customSkills = JSON.parse(raw);
        // Merge built-in skills with custom installed skills
        const customMap = new Map(customSkills.map((s) => [s.id, s]));
        this.skills = BUILT_IN_SKILLS.map((b) => {
          if (customMap.has(b.id)) {
            const saved = customMap.get(b.id);
            customMap.delete(b.id);
            return { ...b, enabled: saved.enabled !== undefined ? saved.enabled : b.enabled };
          }
          return b;
        });

        // Add remaining custom skills
        for (const s of customMap.values()) {
          this.skills.push(s);
        }
      } else {
        this.skills = [...BUILT_IN_SKILLS];
        this.saveSkills();
      }
    } catch (err) {
      console.warn('[SkillManager] Failed to load skills:', err.message);
      this.skills = [...BUILT_IN_SKILLS];
    }
  }

  saveSkills() {
    try {
      fs.writeFileSync(this.skillsPath, JSON.stringify(this.skills, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('[SkillManager] Failed to save skills:', err);
      return false;
    }
  }

  listSkills() {
    return this.skills;
  }

  getActiveSkills() {
    return this.skills.filter((s) => s.enabled);
  }

  toggleSkill(id, enabled) {
    const s = this.skills.find((x) => x.id === id);
    if (s) {
      s.enabled = enabled !== undefined ? enabled : !s.enabled;
      this.saveSkills();
      return s;
    }
    throw new Error(`Skill ${id} not found`);
  }

  removeSkill(id) {
    const idx = this.skills.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`Skill ${id} not found`);
    if (this.skills[idx].builtin) {
      // Don't delete built-in, just disable
      this.skills[idx].enabled = false;
    } else {
      this.skills.splice(idx, 1);
    }
    this.saveSkills();
    return true;
  }

  saveCustomSkill(skillData) {
    if (!skillData.id || !skillData.name) {
      throw new Error('Skill requires at least id and name');
    }
    const idx = this.skills.findIndex((s) => s.id === skillData.id);
    const skill = {
      id: skillData.id.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
      name: skillData.name,
      description: skillData.description || '',
      triggers: Array.isArray(skillData.triggers) ? skillData.triggers : [],
      instructions: skillData.instructions || '',
      enabled: skillData.enabled !== undefined ? skillData.enabled : true,
      builtin: false,
      source: skillData.source || 'custom',
    };

    if (idx >= 0) {
      this.skills[idx] = skill;
    } else {
      this.skills.push(skill);
    }
    this.saveSkills();
    return skill;
  }

  /**
   * Install or fetch a skill from GitHub.
   * Supports:
   * 1. Direct raw URL: https://raw.githubusercontent.com/owner/repo/main/SKILL.md
   * 2. GitHub repo URL: https://github.com/owner/repo or owner/repo
   * 3. Sub-path: owner/repo/path/to/skill
   */
  async installSkillFromGitHub(inputUrlOrRepo) {
    let rawUrl = '';
    let repoName = '';

    const cleanInput = inputUrlOrRepo.trim();

    if (cleanInput.startsWith('https://raw.githubusercontent.com/')) {
      rawUrl = cleanInput;
      const parts = cleanInput.split('/');
      repoName = parts[4] || 'github-skill';
    } else if (cleanInput.startsWith('https://github.com/')) {
      const pathPart = cleanInput.replace('https://github.com/', '').replace(/\/$/, '');
      const segments = pathPart.split('/');
      const owner = segments[0];
      const repo = segments[1];
      repoName = repo;

      if (segments.includes('blob') || segments.includes('raw')) {
        const branchIndex = segments.findIndex((s) => s === 'blob' || s === 'raw');
        const rest = segments.slice(branchIndex + 1).join('/');
        rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${rest}`;
      } else {
        // Try common skill filenames
        rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;
      }
    } else if (cleanInput.includes('/')) {
      // Format: owner/repo or owner/repo/path
      const segments = cleanInput.split('/');
      const owner = segments[0];
      const repo = segments[1];
      repoName = repo;
      const subpath = segments.slice(2).join('/');
      if (subpath) {
        rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${subpath}/SKILL.md`;
      } else {
        rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;
      }
    } else {
      throw new Error(`Invalid GitHub repository or URL format: "${cleanInput}"`);
    }

    // Attempt fetch with fallback filenames (SKILL.md, skill.md, README.md, prompt.md)
    const candidateUrls = [
      rawUrl,
      rawUrl.replace('/main/', '/master/'),
      rawUrl.replace(/SKILL\.md$/i, 'skill.md'),
      rawUrl.replace(/SKILL\.md$/i, 'README.md'),
      rawUrl.replace(/SKILL\.md$/i, 'prompt.md'),
    ];

    let content = '';
    let successUrl = '';
    let lastError = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ApkRtool-IDE-Agent' },
        });
        if (res.ok) {
          content = await res.text();
          successUrl = url;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!content) {
      throw new Error(`Failed to download skill from GitHub. Checked candidates starting with ${rawUrl} (${lastError ? lastError.message : 'Not Found'})`);
    }

    // Parse the markdown skill
    const parsed = this.parseSkillMarkdown(content, repoName, successUrl);
    return this.saveCustomSkill(parsed);
  }

  parseSkillMarkdown(markdown, defaultName, sourceUrl) {
    let name = defaultName;
    let description = '';
    let instructions = markdown;
    const triggers = [];

    // Check YAML Frontmatter
    if (markdown.startsWith('---')) {
      const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
      if (match) {
        const yamlBlock = match[1];
        instructions = match[2].trim();

        const nameMatch = yamlBlock.match(/name:\s*["']?([^"'\r\n]+)["']?/i);
        const descMatch = yamlBlock.match(/description:\s*["']?([^"'\r\n]+)["']?/i);
        const triggersMatch = yamlBlock.match(/triggers:\s*\[(.*?)\]/i);

        if (nameMatch) name = nameMatch[1].trim();
        if (descMatch) description = descMatch[1].trim();
        if (triggersMatch) {
          triggers.push(
            ...triggersMatch[1]
              .split(',')
              .map((t) => t.replace(/["']/g, '').trim())
              .filter(Boolean)
          );
        }
      }
    }

    // Fallback title from # Header
    if (name === defaultName) {
      const h1Match = markdown.match(/^#\s+(.+)$/m);
      if (h1Match) name = h1Match[1].trim();
    }

    if (!description) {
      const firstPara = instructions
        .split(/\n\n+/)
        .map((p) => p.trim())
        .find((p) => p && !p.startsWith('#'));
      description = firstPara ? firstPara.slice(0, 160) : 'Custom skill imported from GitHub';
    }

    const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    return {
      id,
      name,
      description,
      triggers: triggers.length ? triggers : [id],
      instructions,
      source: sourceUrl,
    };
  }

  formatSkillsForSystemPrompt() {
    const active = this.getActiveSkills();
    if (!active.length) return '';

    return `\n## ACTIVE SKILLS & SPECIALIZED CAPABILITIES\n${active
      .map(
        (s) =>
          `### Skill: ${s.name} (id: ${s.id})\nDescription: ${s.description}\nTriggers: ${s.triggers.join(
            ', '
          )}\nInstructions:\n${s.instructions}\n`
      )
      .join('\n---\n')}\n`;
  }
}

let skillManagerInstance = null;
function getSkillManager() {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager();
  }
  return skillManagerInstance;
}

module.exports = {
  SkillManager,
  getSkillManager,
  BUILT_IN_SKILLS,
};
