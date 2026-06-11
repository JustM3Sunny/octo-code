/**
 * Install Claude Code compatible skills from cached GitHub repos into .claude/skills/
 * Run: bun run scripts/install-claude-skills.ts
 */
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const ROOT = path.resolve(import.meta.dir, '..')
const CACHE = path.join(ROOT, '_skills-cache')
const TARGET = path.join(ROOT, '.claude', 'skills')

const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

type SkillSource = {
  label: string
  roots: string[]
}

const SOURCES: SkillSource[] = [
  {
    label: 'anthropics/skills',
    roots: [path.join(CACHE, 'anthropics-skills', 'skills')],
  },
  {
    label: 'Eyadkelleh/awesome-skills-security',
    roots: [path.join(CACHE, 'awesome-skills-security', 'skills')],
  },
  {
    label: 'frendysanusi/claude-pentest-skills',
    roots: [path.join(CACHE, 'claude-pentest-skills')],
  },
  {
    label: 'trilwu/secskills',
    roots: [path.join(CACHE, 'secskills', 'secskills', 'skills')],
  },
  {
    label: 'trailofbits/skills',
    roots: [path.join(CACHE, 'trailofbits-skills', 'plugins')],
  },
  {
    label: 'mukul975/Anthropic-Cybersecurity-Skills',
    roots: [path.join(CACHE, 'cyber-skills', 'skills')],
  },
]

function findSkillDirs(root: string, results: string[] = []): string[] {
  if (!fs.existsSync(root)) return results

  const skillFile = path.join(root, 'SKILL.md')
  if (fs.existsSync(skillFile)) {
    results.push(root)
    return results
  }

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    findSkillDirs(path.join(root, entry.name), results)
  }

  return results
}

function validateSkill(skillDir: string): { ok: true; name: string; needsDescriptionTrim: boolean } | { ok: false; reason: string } {
  const dirName = path.basename(skillDir)
  const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
  const parsed = matter(content)
  const name = parsed.data?.name
  const description = parsed.data?.description

  const resolvedName = typeof name === 'string' && SKILL_NAME_REGEX.test(name) ? name : dirName

  if (!SKILL_NAME_REGEX.test(resolvedName)) {
    return { ok: false, reason: `invalid skill name: ${resolvedName} (${skillDir})` }
  }
  if (typeof description !== 'string' || description.length < 1) {
    return { ok: false, reason: `missing description in ${resolvedName}` }
  }

  const needsDescriptionTrim = description.length > 1024
  return { ok: true, name: resolvedName, needsDescriptionTrim }
}

function copySkillDir(skillDir: string, dest: string, needsDescriptionTrim: boolean) {
  fs.mkdirSync(dest, { recursive: true })

  for (const entry of fs.readdirSync(skillDir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const srcPath = path.join(skillDir, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else if (entry.name === 'SKILL.md' && needsDescriptionTrim) {
      const content = fs.readFileSync(srcPath, 'utf8')
      const parsed = matter(content)
      const desc = String(parsed.data.description)
      parsed.data.description = desc.slice(0, 1020).trimEnd() + '...'
      const trimmed = matter.stringify(parsed.content, parsed.data)
      fs.writeFileSync(destPath, trimmed)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv'])

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function main() {
  fs.mkdirSync(TARGET, { recursive: true })

  const installed = new Map<string, string>()
  const skipped: string[] = []
  const failed: string[] = []
  const manifest: Array<{ name: string; source: string; path: string }> = []

  for (const source of SOURCES) {
    const skillDirs = source.roots.flatMap((root) => findSkillDirs(root))
    console.log(`\n[${source.label}] found ${skillDirs.length} skill directories`)

    for (const skillDir of skillDirs) {
      const validation = validateSkill(skillDir)
      if (!validation.ok) {
        failed.push(`${source.label}: ${validation.reason}`)
        continue
      }

      const { name, needsDescriptionTrim } = validation
      const dest = path.join(TARGET, name)

      if (installed.has(name)) {
        skipped.push(`${name} (duplicate from ${source.label}, kept ${installed.get(name)})`)
      }

      copySkillDir(skillDir, dest, needsDescriptionTrim)
      installed.set(name, source.label)
      manifest.push({ name, source: source.label, path: `.claude/skills/${name}` })
    }
  }

  const manifestPath = path.join(TARGET, '_manifest.json')
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        total: manifest.length,
        sources: SOURCES.map((s) => s.label),
        skills: manifest.sort((a, b) => a.name.localeCompare(b.name)),
      },
      null,
      2,
    ),
  )

  console.log(`\n✅ Installed ${installed.size} skills → ${TARGET}`)
  console.log(`⚠️  Skipped ${skipped.length} duplicates`)
  console.log(`❌ Failed ${failed.length} invalid skills`)

  if (failed.length > 0 && failed.length <= 20) {
    console.log('\nFailed:')
    for (const f of failed) console.log(`  - ${f}`)
  } else if (failed.length > 20) {
    console.log('\nFirst 20 failures:')
    for (const f of failed.slice(0, 20)) console.log(`  - ${f}`)
  }
}

main()
