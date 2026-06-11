import type { SkillDefinition, SkillsMap } from '../types/skill'

/** Max skills listed in the skill tool description (all remain loadable by name). */
export const MAX_SKILLS_IN_TOOL_DESCRIPTION = 80

/** Max characters per skill description in the tool listing. */
export const MAX_SKILL_DESCRIPTION_IN_LISTING = 160

const PRIORITY_SKILL_NAMES = new Set([
  'webapp-testing',
  'skill-creator',
  'claude-pentest-skills',
  'llm-testing',
  'security-fuzzing',
  'security-payloads',
  'security-patterns',
  'semgrep',
  'codeql',
  'attacking-active-directory',
  'testing-apis',
  'exploiting-cloud-platforms',
  'frontend-design',
  'mcp-builder',
])

/**
 * Escapes special XML characters in a string.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncateDescription(description: string): string {
  if (description.length <= MAX_SKILL_DESCRIPTION_IN_LISTING) {
    return description
  }
  return `${description.slice(0, MAX_SKILL_DESCRIPTION_IN_LISTING - 3).trimEnd()}...`
}

function sortSkillsForListing(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((a, b) => {
    const aPriority = PRIORITY_SKILL_NAMES.has(a.name) ? 0 : 1
    const bPriority = PRIORITY_SKILL_NAMES.has(b.name) ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return a.name.localeCompare(b.name)
  })
}

/**
 * Formats available skills as XML for inclusion in tool descriptions.
 * Lists a capped subset to avoid blowing the context window; all installed
 * skills remain loadable via skill({ name }) by exact name.
 */
export function formatAvailableSkillsXml(skills: SkillsMap): string {
  const skillEntries = Object.values(skills)
  if (skillEntries.length === 0) {
    return ''
  }

  const sorted = sortSkillsForListing(skillEntries)
  const listed = sorted.slice(0, MAX_SKILLS_IN_TOOL_DESCRIPTION)
  const omitted = skillEntries.length - listed.length

  const skillsXml = listed
    .map(
      (skill) =>
        `  <skill>\n    <name>${skill.name}</name>\n    <description>${escapeXml(truncateDescription(skill.description))}</description>\n  </skill>`,
    )
    .join('\n')

  const note =
    omitted > 0
      ? `\n  <note>${omitted} more skills are installed (${skillEntries.length} total). Load any skill by exact name with the skill tool. Full list: .claude/skills/_manifest.json</note>`
      : ''

  return `<available_skills>\n${skillsXml}${note}\n</available_skills>`
}
