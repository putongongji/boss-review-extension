import { afterEach, describe, expect, it, vi } from 'vitest'

import { DomBossAdapter } from '@/page/bossAdapter'

describe('DomBossAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('captures visible job cards from DOM', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-1.html">
        <span class="job-name">AI 产品经理</span>
        <span class="boss-name">王女士</span>
        <span class="boss-title">HR</span>
        <span class="salary">25-35K</span>
        <span class="job-area">上海</span>
        <span class="company-name">示例科技</span>
        <span class="tag">AI产品</span>
      </a>
    `

    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()

    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      jobId: 'job-1',
      title: 'AI 产品经理',
      company: '示例科技',
      salary: '25-35K',
      location: '上海',
      recruiterName: '王女士',
    })
  })

  it('captures a direct anchor job card without global HTMLAnchorElement', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-anchor.html">
        <span class="job-name">增长产品经理</span>
        <span class="company-name">增长科技</span>
      </a>
    `
    vi.stubGlobal('HTMLAnchorElement', undefined)

    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()

    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      jobId: 'job-anchor',
      title: '增长产品经理',
      company: '增长科技',
    })
  })

  it('deduplicates duplicate cards by jobId', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-duplicate.html">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
      <a class="job-card-wrapper" href="/job_detail/job-duplicate.html">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `

    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()

    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.jobId).toBe('job-duplicate')
  })

  it('detects next page availability', () => {
    document.body.innerHTML = `<button class="next">下一页</button>`

    const adapter = new DomBossAdapter(document)

    expect(adapter.hasNextPage()).toBe(true)
  })

  it('clicks the detected next page button', async () => {
    document.body.innerHTML = `<button class="next">下一页</button>`
    const nextButton = document.querySelector<HTMLButtonElement>('.next')
    const clickSpy = vi.spyOn(nextButton!, 'click')

    const adapter = new DomBossAdapter(document, { emptyListWaitMs: 0 })

    await expect(adapter.goNextPage()).resolves.toBe(true)
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('waits for job list replacement after clicking next page', async () => {
    document.body.innerHTML = `
      <div class="job-list">
        <a class="job-card-wrapper" href="/job_detail/job-page-1.html">
          <span class="job-name">AI 产品经理</span>
          <span class="company-name">示例科技</span>
        </a>
      </div>
      <button class="next">下一页</button>
    `
    const jobList = document.querySelector<HTMLElement>('.job-list')!
    document.querySelector<HTMLButtonElement>('.next')!.addEventListener('click', () => {
      setTimeout(() => {
        jobList.innerHTML = `
          <a class="job-card-wrapper" href="/job_detail/job-page-2.html">
            <span class="job-name">增长产品经理</span>
            <span class="company-name">增长科技</span>
          </a>
        `
      }, 5)
    })
    const adapter = new DomBossAdapter(document, { pageTransitionPollMs: 1, pageTransitionTimeoutMs: 50 })

    await expect(adapter.goNextPage()).resolves.toBe(true)
    const jobs = await adapter.captureCurrentPage()

    expect(jobs.map((job) => job.jobId)).toEqual(['job-page-2'])
  })
})
