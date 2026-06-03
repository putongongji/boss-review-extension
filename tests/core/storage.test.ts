import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/defaults'
import { createMemoryStorageArea, ExtensionStorage } from '@/core/storage'

describe('ExtensionStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns default settings when storage is empty', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await expect(storage.getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('merges partial settings with defaults', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await storage.saveSettings({ maxPages: 2, maxJobs: 20 })

    await expect(storage.getSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      maxPages: 2,
      maxJobs: 20,
    })
  })

  it('stores resume material and dedupe keys', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await storage.saveResumeMaterial('6年产品经理经验')
    await storage.markCompanyReviewed('company-1')
    await storage.markRecruiterReviewed('recruiter-1')

    await expect(storage.getResumeMaterial()).resolves.toBe('6年产品经理经验')
    await expect(storage.hasCompanyReviewed('company-1')).resolves.toBe(true)
    await expect(storage.hasRecruiterReviewed('recruiter-1')).resolves.toBe(true)
  })
})
