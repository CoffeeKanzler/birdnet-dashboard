import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

const getFreePort = async () => {
  const server = createServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const port = server.address().port
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()))
  })
  return port
}

const waitUntilHealthy = async (child, port) => {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Dashboard server exited early with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`)
      if (response.ok) return
    } catch {
      // Wait for the listener to become ready.
    }
    await delay(50)
  }
  throw new Error('Dashboard server did not become healthy within 5 seconds')
}

describe('detections pagination fallback', () => {
  it('keeps cached fallback responses within the page limit after upstream 503', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'birdnet-pagination-test-'))
    const upstream = createServer((_request, response) => {
      response.writeHead(503, { 'content-type': 'application/json' })
      response.end('{"message":"unavailable"}')
    })
    await new Promise((resolveListen, rejectListen) => {
      upstream.once('error', rejectListen)
      upstream.listen(0, '127.0.0.1', resolveListen)
    })

    const port = await getFreePort()
    const generatedAt = '2030-01-01T00:00:00.000Z'
    const detections = Array.from({ length: 1000 }, (_, index) => ({
      id: index + 1,
      common_name: 'Test bird',
      scientific_name: 'Testus avianus',
      confidence: 0.9,
      endTime: `2029-12-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    }))
    const summaryPath = join(cacheDir, 'summary.json')
    const recentPath = join(cacheDir, 'recent.json')
    const familyPath = join(cacheDir, 'family.json')
    await writeFile(
      summaryPath,
      JSON.stringify({ generated_at: generatedAt, stats: {}, archive: { groups: [] } }),
    )
    await writeFile(recentPath, JSON.stringify({ generated_at: generatedAt, detections }))
    await writeFile(familyPath, JSON.stringify({ generated_at: generatedAt, entries: [] }))

    const child = spawn(process.execPath, [resolve(repoRoot, 'server/server.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        BIRDNET_API_BASE_URL: `http://127.0.0.1:${upstream.address().port}`,
        INTERNAL_PROXY_VALUE: 'test-only-internal-proxy-value-32chars',
        SUMMARY_CACHE_FILE: summaryPath,
        RECENT_CACHE_FILE: recentPath,
        FAMILY_CACHE_FILE: familyPath,
        RECENT_REFRESH_MS: '3600000',
      },
      stdio: 'ignore',
    })

    try {
      await waitUntilHealthy(child, port)
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v2/detections?numResults=999999&offset=0`,
        { headers: { 'x-internal-summary-proxy': 'test-only-internal-proxy-value-32chars' } },
      )
      const payload = await response.json()
      expect(response.status).toBe(200)
      expect(response.headers.get('x-detections-cache')).toBe('stale')
      expect(payload).toHaveLength(500)
    } finally {
      if (child.exitCode === null) {
        const exited = once(child, 'exit')
        child.kill('SIGTERM')
        await Promise.race([exited, delay(2_000)])
      }
      await new Promise((resolveClose) => upstream.close(() => resolveClose()))
      await rm(cacheDir, { recursive: true, force: true })
    }
  }, 15_000)
})
