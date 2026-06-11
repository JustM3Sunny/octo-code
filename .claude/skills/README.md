# SIYA Claude Code Skills

Curated skills installed from public GitHub repositories for SIYA agents.

## Sources

| Repository | Skills | Focus |
|------------|--------|-------|
| [anthropics/skills](https://github.com/anthropics/skills) | 17 | Official Anthropic skills (webapp-testing, frontend-design, skill-creator, etc.) |
| [Eyadkelleh/awesome-skills-security](https://github.com/Eyadkelleh/awesome-skills-security) | 7 | SecLists payloads, fuzzing, LLM security testing |
| [frendysanusi/claude-pentest-skills](https://github.com/frendysanusi/claude-pentest-skills) | 1 | OWASP web pentest methodology |
| [trilwu/secskills](https://github.com/trilwu/secskills) | 13 | AD, cloud, mobile, wireless, privesc |
| [trailofbits/skills](https://github.com/trailofbits/skills) | 74 | Security audits, fuzzing, static analysis |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 754 | Ethical hacking, MITRE ATT&CK, pentesting |

## Usage in SIYA

- Agents load skills via the `skill` tool: `skill({ name: "webapp-testing" })`
- Slash commands: `/skill:webapp-testing` (when skills are loaded at CLI startup)
- Skills live in `.claude/skills/` (Claude Code compatible; SIYA also reads `.agents/skills/`)

## Refresh skills

```bash
cd siya
bun run scripts/install-claude-skills.ts
```

This reads from `_skills-cache/` (gitignored). To update from GitHub:

```bash
cd _skills-cache/anthropics-skills && git pull
# repeat for other repos, then re-run install script
```

## Security notice

Many skills cover **authorized penetration testing only**. Use only on systems you own or have written permission to test. Review `SKILL.md` before use — skills can include offensive security guidance.

## Manifest

See `_manifest.json` for the full list of installed skills and their source repos.
