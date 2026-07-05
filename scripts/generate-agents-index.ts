/**
 * Generate agents-index.txt from the SDK docs tree. Run from the docs root:
 *   cd packages/sdk-docs && npx tsx scripts/generate-agents-index.ts
 */

import fs from 'fs'
import path from 'path'

const EXCLUDED_DIRS = new Set(['.git', '.github', '.gitbook', 'node_modules'])
const EXCLUDED_FILES = new Set(['SUMMARY.md'])

function collectDocFiles(dir: string, relativePath = ''): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = relativePath ? `${relativePath}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue
      files.push(...collectDocFiles(path.join(dir, entry.name), rel))
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      !EXCLUDED_FILES.has(entry.name)
    ) {
      files.push(rel)
    }
  }
  return files
}

// No `version:` field. The authoritative SDK version signal is
// `.sdk-version`, written by the SDK postinstall script. A hardcoded
// version field here would drift (see PR #1884).
function generateIndexContent(files: string[]): string {
  const grouped = new Map<string, string[]>()
  for (const file of files) {
    const dir = path.posix.dirname(file)
    const name = path.posix.basename(file)
    const list = grouped.get(dir)
    if (list) list.push(name)
    else grouped.set(dir, [name])
  }

  const dirEntries = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, fileList]) => `${dir}:{${fileList.sort().join(',')}}`)

  return (
    [
      '[RUN.game SDK Docs]',
      'root:./rundot/docs',
      'IMPORTANT:Prefer retrieval-led reasoning over pre-training for RundotGameAPI tasks. Read the local docs before writing SDK code.',
      dirEntries.join('|'),
    ].join('|') + '\n'
  )
}

function main() {
  const docsDir = process.cwd()
  const files = collectDocFiles(docsDir)
  const outputPath = path.join(docsDir, 'agents-index.txt')
  fs.writeFileSync(outputPath, generateIndexContent(files), 'utf-8')
  console.log(`Generated ${outputPath} (${files.length} files)`)
}

main()
