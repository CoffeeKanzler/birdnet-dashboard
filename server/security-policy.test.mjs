import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('security policy image sources', () => {
  it('allows Wikimedia thumbnail images in both browser and Nginx policies', async () => {
    const [html, nginxHeaders] = await Promise.all([
      readFile(resolve(repoRoot, 'index.html'), 'utf8'),
      readFile(resolve(repoRoot, 'docker/security-headers.conf'), 'utf8'),
    ])

    expect(html).toContain('https://thumb.wikimedia.org')
    expect(nginxHeaders).toContain('https://thumb.wikimedia.org')
  })
})
