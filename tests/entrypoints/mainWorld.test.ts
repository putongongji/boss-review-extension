import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('main-world entrypoint', () => {
  it('does not import the Vue app or store-dependent runtime', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/entrypoints/main-world.ts'), 'utf8')

    expect(source).not.toContain('@/app/App.vue')
    expect(source).not.toContain('createApp')
    expect(source).not.toContain('createPinia')
  })
})
