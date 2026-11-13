// Rebuilds content/ from the almirah vault. Only notes with `intranet: true` are copied.
// The home page is the vault note "Casegoods Intranet".
// Notes with a `password:` property are refused unless ALLOW_PASSWORD_PAGES=1: the repo is public,
// so a password in the source would be readable by anyone (the page encryption would be pointless).
import fs from "node:fs"
import path from "node:path"

const repo = path.resolve(import.meta.dirname, "..")
const vault = ["/Users/casegoods01/Documents/almirah", "/Users/PREDATOR/Documents/almirah"].find((p) =>
  fs.existsSync(path.join(p, "Notes")),
)
if (!vault) throw new Error("Could not find the almirah vault.")

const SOURCE_FOLDERS = ["Casegoods", "Notes", "References"]
const HOME = "Casegoods Intranet.md"
const KEEP_KEYS = new Set(["title", "date", "aliases", "tags", "password"])
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i

const splitNote = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n?---\n?/)
  return m ? [m[1], text.slice(m[0].length)] : ["", text]
}

// Top-level frontmatter blocks, so a key's list items travel with it.
const blocks = (fm) => {
  const out = []
  for (const line of fm.split("\n")) {
    if (/^\S/.test(line)) out.push({ key: line.split(":")[0], lines: [line] })
    else out.at(-1)?.lines.push(line)
  }
  return out
}

const published = []
for (const folder of SOURCE_FOLDERS) {
  for (const file of fs.readdirSync(path.join(vault, folder))) {
    if (!file.endsWith(".md")) continue
    const text = fs.readFileSync(path.join(vault, folder, file), "utf8")
    const [fm, body] = splitNote(text)
    if (!/^intranet:\s*true\s*$/m.test(fm)) continue
    if (/^password:/m.test(fm) && process.env.ALLOW_PASSWORD_PAGES !== "1") {
      console.warn(`Skipped ${file}: it has a password, and this repo's source is public.`)
      continue
    }
    published.push({ file, fm, body })
  }
}
if (published.length === 0) throw new Error("No notes marked intranet: true. Leaving content/ untouched.")

if (!published.some((n) => n.file === HOME)) throw new Error(`The home note "${HOME}" needs intranet: true.`)
const names = new Set(published.map((n) => n.file.slice(0, -3).toLowerCase()))
const images = new Set()
const isPublished = (target) => names.has(target.split("#")[0].trim().toLowerCase())

const convertLinks = (text) =>
  text
    .replace(/(!?)\[\[([^\]]+)\]\]/g, (whole, bang, inner) => {
      const [target, alias] = inner.split("|")
      if (bang) {
        if (!IMAGE.test(target)) return ""
        images.add(target.trim())
        return whole
      }
      return isPublished(target) ? whole : (alias ?? target.split("#")[0]).trim()
    })
    // Markdown links that point inside the vault become plain text.
    .replace(/(?<!!)\[([^\]]+)\]\((?!https?:|mailto:|#)[^)]*\)/g, "$1")

const cleanBody = (body) => {
  const lines = []
  let quoteDraft = false
  let inRelated = false
  for (const line of body.split("\n")) {
    // "## Related" sections stay, but only items that link to a published note.
    if (/^##\s+related\s*$/i.test(line)) {
      inRelated = true
      lines.push(line)
      continue
    }
    if (inRelated && /^#{1,2}\s/.test(line)) inRelated = false
    if (inRelated && /^\s*[-*]\s/.test(line)) {
      const first = line.match(/\[\[([^\]]+)\]\]/)
      if (!first || !isPublished(first[1].split("|")[0])) continue
    }
    if (/^_\[your note:/.test(line)) continue
    if (/^> \*\*populate suggestion/.test(line)) {
      quoteDraft = true
      continue
    }
    if (quoteDraft && line.startsWith(">")) continue
    quoteDraft = false
    // A list line that is only links to private notes ("- Dailies: [[2026-03-09]] · [[2026-03-11]]")
    // would render as bare titles: drop it.
    if (/^\s*[-*]\s*([\w ]+:)?\s*(\[\[[^\]]+\]\][\s·,]*)+$/.test(line)) {
      const links = [...line.matchAll(/\[\[([^\]]+)\]\]/g)]
      if (!links.some((m) => isPublished(m[1].split("|")[0]))) continue
    }
    if (/^see also:/i.test(line)) {
      const kept = [...line.matchAll(/\[\[([^\]]+)\]\]/g)].filter((m) => isPublished(m[1].split("|")[0]))
      if (kept.length) lines.push(`see also: ${kept.map((m) => m[0]).join(", ")}`)
      continue
    }
    lines.push(line)
  }
  const text = convertLinks(lines.join("\n"))
    .replace(/%%[\s\S]*?%%/g, "") // Obsidian comments are private prompts
    .replace(/\n{3,}/g, "\n\n")
    // Drop a "## My thinking" heading that has nothing under it yet.
    .replace(/^## My thinking\s*\n+(?=## |$)/m, "")
    // Drop a Related heading left with no items.
    .replace(/^## Related\s*\n+(?=#|$(?![\s\S]))/m, "")
  return text.trim() + "\n"
}

const contentDir = path.join(repo, "content")
fs.rmSync(contentDir, { recursive: true, force: true })
fs.mkdirSync(contentDir)
for (const { file, fm, body } of published) {
  const kept = blocks(fm)
    .filter((b) => KEEP_KEYS.has(b.key) && !b.lines.join("\n").includes("Keep/"))
    .flatMap((b) => b.lines)
  const head = kept.length ? `---\n${kept.join("\n")}\n---\n` : ""
  if (file === HOME) {
    // The home page takes its title from the note's first heading instead of "index".
    const h1 = body.match(/^# (.+)\n/m)
    const title = h1 ? h1[1].trim() : "casenotes"
    const rest = h1 ? body.replace(h1[0], "") : body
    fs.writeFileSync(path.join(contentDir, "index.md"), `---\ntitle: ${title}\n---\n` + cleanBody(rest))
    continue
  }
  fs.writeFileSync(path.join(contentDir, file), head + cleanBody(body))
}

for (const image of images) {
  const source = path.join(vault, "Attachments", image)
  if (!fs.existsSync(source)) {
    console.warn(`Missing image: ${image}`)
    continue
  }
  fs.mkdirSync(path.join(contentDir, "Images"), { recursive: true })
  fs.copyFileSync(source, path.join(contentDir, "Images", image))
}

console.log(`Published ${published.length} notes and ${images.size} images:`)
for (const n of published.map((n) => n.file).sort()) console.log(`  ${n}`)
