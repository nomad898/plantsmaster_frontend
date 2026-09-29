import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const plantsPath = path.join(root, 'public', 'plants.json')
const imageDir = path.join(root, 'public', 'images', 'plants')
const manifestPath = path.join(imageDir, 'manifest.json')
const apiBase = 'https://en.wikipedia.org/api/rest_v1/page/summary/'
const userAgent = 'PlantsMaster/1.0 (local research frontend; image cache preparation)'

async function fetchSafe(url) {
  try {
    return await fetch(url, { headers: { 'User-Agent': userAgent } })
  } catch (error) {
    console.warn(`request failed: ${url} (${error instanceof Error ? error.message : 'unknown error'})`)
    return null
  }
}

const plants = JSON.parse(await readFile(plantsPath, 'utf8'))
let manifest = {}
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
} catch {
  manifest = {}
}
await mkdir(imageDir, { recursive: true })

for (const plant of plants) {
  const key = String(plant.id)
  if (manifest[key]) continue
  for (const extension of ['jpg', 'png', 'webp']) {
    const existingPath = path.join(imageDir, `${plant.id}.${extension}`)
    try {
      await access(existingPath)
      manifest[key] = {
        plantId: plant.id,
        scientificName: plant.name_la,
        localUrl: `./images/plants/${plant.id}.${extension}`,
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(plant.name_la.replace(/\s+/g, '_'))}`,
        source: 'Wikipedia',
        retrievedAt: new Date().toISOString(),
        license: 'See the original Wikipedia/Wikimedia Commons page before publication',
      }
      break
    } catch {}
  }
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

if (process.argv.includes('--reconcile-only')) {
  console.log(JSON.stringify({ reconciled: Object.keys(manifest).length, manifest: manifestPath }, null, 2))
  process.exit(0)
}

let downloaded = 0
let skipped = 0
let unavailable = 0
const limitArgument = process.argv.find(argument => argument.startsWith('--limit='))
const downloadLimit = limitArgument ? Math.max(0, Number.parseInt(limitArgument.slice('--limit='.length), 10)) : Number.POSITIVE_INFINITY

for (const plant of plants) {
  if (downloaded >= downloadLimit) break
  const key = String(plant.id)
  if (manifest[key]) {
    skipped += 1
    continue
  }

  const title = plant.name_la.replace(/\s+/g, '_')
  const summaryResponse = await fetchSafe(`${apiBase}${encodeURIComponent(title)}`)
  if (!summaryResponse?.ok) {
    unavailable += 1
    continue
  }
  const summary = await summaryResponse.json()
  const thumbnailUrl = summary.thumbnail?.source
  if (!thumbnailUrl) {
    unavailable += 1
    continue
  }

  const imageResponse = await fetchSafe(thumbnailUrl)
  if (!imageResponse?.ok) {
    unavailable += 1
    continue
  }

  const contentType = imageResponse.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const fileName = `${plant.id}.${extension}`
  const filePath = path.join(imageDir, fileName)
  await writeFile(filePath, Buffer.from(await imageResponse.arrayBuffer()))
  manifest[key] = {
    plantId: plant.id,
    scientificName: plant.name_la,
    localUrl: `./images/plants/${fileName}`,
    sourceUrl: thumbnailUrl,
    source: 'Wikipedia',
    retrievedAt: new Date().toISOString(),
    license: 'See the original Wikipedia/Wikimedia Commons page before publication',
  }
  downloaded += 1

  if (downloaded % 25 === 0) {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`cached ${downloaded} images`)
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ downloaded, skipped, unavailable, limit: downloadLimit, total: plants.length, manifest: manifestPath }, null, 2))
