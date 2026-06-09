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

  it('returns fresh default settings arrays', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    const first = await storage.getSettings()
    first.blacklistCompanies.push('公司')
    first.blacklistRecruiters.push('招聘者')
    first.keywordExcludes.push('新增')

    const second = await storage.getSettings()

    expect(second.blacklistCompanies).not.toContain('公司')
    expect(second.blacklistRecruiters).not.toContain('招聘者')
    expect(second.keywordExcludes).not.toContain('新增')
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

  it('returns empty greeted jobs when nothing stored', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())
    await expect(storage.getGreetedJobs()).resolves.toEqual([])
    await expect(storage.getGreetedJobIds()).resolves.toEqual(new Set())
    await expect(storage.getTodayGreetedCount()).resolves.toBe(0)
  })

  it('records greeted jobs and returns IDs of successful ones', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())
    const now = Date.now()

    await storage.markJobGreeted({
      jobId: 'job-1',
      greetedAt: now,
      success: true,
      customGreetingSent: false,
      resultMessage: '已发送',
    })
    await storage.markJobGreeted({
      jobId: 'job-2',
      greetedAt: now,
      success: false,
      customGreetingSent: false,
      error: '打招呼失败',
      resultMessage: '失败',
    })

    const jobs = await storage.getGreetedJobs()
    expect(jobs).toHaveLength(2)

    const ids = await storage.getGreetedJobIds()
    expect(ids.has('job-1')).toBe(true)
    expect(ids.has('job-2')).toBe(false) // failed job not in set

    const todayCount = await storage.getTodayGreetedCount()
    expect(todayCount).toBe(1)
  })

  it('replaces existing greeted record for the same jobId', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())

    await storage.markJobGreeted({
      jobId: 'job-1',
      greetedAt: Date.now(),
      success: false,
      customGreetingSent: false,
      error: '第一次失败',
      resultMessage: '失败',
    })
    await storage.markJobGreeted({
      jobId: 'job-1',
      greetedAt: Date.now(),
      success: true,
      customGreetingSent: true,
      resultMessage: '重试成功',
    })

    const jobs = await storage.getGreetedJobs()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].success).toBe(true)
    expect(jobs[0].resultMessage).toBe('重试成功')

    const ids = await storage.getGreetedJobIds()
    expect(ids.has('job-1')).toBe(true)
  })

  it('counts only today successful greets for daily limit', async () => {
    const storage = new ExtensionStorage(createMemoryStorageArea())
    const yesterday = Date.now() - 24 * 60 * 60 * 1000 - 1000

    await storage.markJobGreeted({
      jobId: 'old-job',
      greetedAt: yesterday,
      success: true,
      customGreetingSent: false,
      resultMessage: '旧的',
    })
    await storage.markJobGreeted({
      jobId: 'today-job',
      greetedAt: Date.now(),
      success: true,
      customGreetingSent: false,
      resultMessage: '今天的',
    })

    const count = await storage.getTodayGreetedCount()
    expect(count).toBe(1)
  })
})
