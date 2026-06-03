import { describe, expect, it } from 'vitest'

import { DomBossAdapter } from '@/page/bossAdapter'

describe('DomBossAdapter', () => {
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

  it('detects next page availability', () => {
    document.body.innerHTML = `<button class="next">下一页</button>`

    const adapter = new DomBossAdapter(document)

    expect(adapter.hasNextPage()).toBe(true)
  })
})
