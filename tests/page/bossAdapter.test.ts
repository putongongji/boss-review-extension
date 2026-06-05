import { describe, expect, it, vi, beforeEach } from 'vitest'

import { DomBossAdapter } from '@/page/bossAdapter'

// Helper: clear cookies and fetch mock before each test
beforeEach(() => {
  // jsdom: reset cookies by removing all
  document.cookie.split(';').forEach((c) => {
    document.cookie = c.replace(/=.*/, '=; max-age=0')
  })
  vi.unstubAllGlobals()
})

describe('DomBossAdapter', () => {
  it('captures jobs from the DOM', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-1.html?securityId=sec1&lid=lid1">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
        <span class="salary">30K-50K</span>
        <span class="job-area">北京</span>
        <span class="tag">3-5年</span>
        <span class="tag">本科</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].jobId).toBe('job-1')
    expect(jobs[0].title).toBe('AI 产品经理')
    expect(jobs[0].company).toBe('示例科技')
    expect(jobs[0].salary).toBe('30K-50K')
    expect(jobs[0].location).toBe('北京')
    expect(jobs[0].experience).toBe('3-5年')
    expect(jobs[0].degree).toBe('本科')
  })

  it('captures jobs with recruiters', async () => {
    document.body.innerHTML = `
      <div class="job-card-box">
        <a href="/job_detail/job-boss.html?securityId=sec-boss&lid=lid-boss">
          <span class="name">测试岗位</span>
        </a>
        <span class="boss-name">李经理</span>
        <span class="boss-title">技术总监</span>
        <span data-boss-id="boss-encrypt-boss"></span>
      </div>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].recruiterName).toBe('李经理')
    expect(jobs[0].recruiterTitle).toBe('技术总监')
    expect(jobs[0].encryptBossId).toBe('boss-encrypt-boss')
    expect(jobs[0].recruiterId).toBe('boss-encrypt-boss')
  })

  it('accepts a Document override', async () => {
    const doc = document.implementation.createHTMLDocument('test')
    const adapter = new DomBossAdapter(doc)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(0)
  })

  it('uses securityId from DOM when available', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-expect.html?securityId=sec-expect&lid=lid-expect">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
        <span data-boss-id="boss-encrypt-expect"></span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].securityId).toBe('sec-expect')
  })

  it('captures from .job-list-card elements', async () => {
    document.body.innerHTML = `
      <div class="job-list-card" ka="job-card">
        <a href="/job_detail/job-list-card.html?securityId=sec-list-card&lid=lid-list-card">
          <span class="job-name">高级工程师</span>
          <span class="company-name">示例科技</span>
        </a>
      </div>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toBe('高级工程师')
  })

  it('deduplicates by job id', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-dupe.html?securityId=sec-dupe&lid=lid-dupe">
        <span class="job-name">重复岗位</span>
        <span class="company-name">示例科技</span>
      </a>
      <a class="job-card-wrapper" href="/job_detail/job-dupe.html?securityId=sec-dupe&lid=lid-dupe">
        <span class="job-name">重复岗位</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
  })

  it('resolves securityId and lid from job URL', async () => {
    // securityId and lid come from the job detail URL query params
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-scope.html?securityId=sec-scope&lid=lid-scope">
        <span class="job-name">安全岗</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].securityId).toBe('sec-scope')
    expect(jobs[0].lid).toBe('lid-scope')
  })

  it('captures job location from a card', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-location.html?securityId=sec-location&lid=lid-location">
        <span class="job-name">测试岗位</span>
        <span class="company-name">示例科技</span>
        <span class="job-area-wrapper">上海·浦东新区</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs[0].location).toBe('上海·浦东新区')
  })

  it('captures job skills from a card', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-skills.html?securityId=sec-skills&lid=lid-skills">
        <span class="job-name">测试岗位</span>
        <span class="company-name">示例科技</span>
        <span class="tag">Python</span>
        <span class="tag">3-5年</span>
        <span class="tag">本科</span>
        <span class="tag">React</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs[0].skills).toContain('Python')
    expect(jobs[0].skills).toContain('React')
    expect(jobs[0].skills).not.toContain('3-5年')
    expect(jobs[0].skills).not.toContain('本科')
  })

  it('sends default greeting', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-default-greet.html?securityId=sec-default-greet&lid=lid-default-greet">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    document.cookie = 'bst=test-token'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ code: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(adapter.greetJob(captured)).resolves.toMatchObject({
      defaultGreetingSent: true,
      customGreetingEnabled: false,
      customGreetingSent: false,
      resultMessage: '已后台打招呼，使用 Boss 默认招呼语',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/wapi/zpgeek/friend/add.json')
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('defMessage')
  })

  it('sends custom greeting after default greeting when enabled', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-custom-enabled.html?securityId=sec-custom-enabled">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
        <span data-boss-id="boss-encrypt-1"></span>
      </a>
    `
    document.cookie = 'bst=test-token'
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ code: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          code: 0,
          zpData: { data: { bossId: 123, encryptBossId: 'boss-encrypt-1' } },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    window.addEventListener('message', (event) => {
      const data = event.data as { type?: string; requestId?: string }
      if (data.type !== 'BRS_SEND_CUSTOM_GREETING') return
      window.postMessage({ type: 'BRS_SEND_CUSTOM_GREETING_RESULT', requestId: data.requestId, ok: true }, '*')
    })

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    // greetJob delays 3s between friend request and custom greeting
    await expect(
      adapter.greetJob(captured, { customMessage: '你好，想了解这个机会。', sendCustomMessage: true }),
    ).resolves.toMatchObject({
      customGreetingEnabled: true,
      customGreetingSent: true,
      resultMessage: '已后台打招呼，并已发送自定义内容',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/wapi/zpgeek/friend/add.json')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/wapi/zpchat/geek/getBossData')
  })

  it('does not send custom greeting when disabled even with customMessage', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-custom-off.html?securityId=sec-custom-off">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    document.cookie = 'bst=test-token'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ code: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(
      adapter.greetJob(captured, { customMessage: '你好', sendCustomMessage: false }),
    ).resolves.toMatchObject({
      customGreetingSent: false,
      resultMessage: '已后台打招呼，使用 Boss 默认招呼语',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a detailed error when securityId is unavailable', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-missing-sec.html">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    document.cookie = 'bst=test-token'

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(adapter.greetJob(captured)).rejects.toThrow('缺少 securityId')
  })

  it('shows a detailed error when bst cookie is missing', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-no-cookie.html?securityId=sec-no-cookie">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    // No cookie set — should fail token check

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(adapter.greetJob(captured)).rejects.toThrow('没有获取到 Boss token')
  })

  it('handles API error in sendFriendAddRequest', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-api-error.html?securityId=sec-api-error&lid=lid-api-error">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    document.cookie = 'bst=test-token'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ code: 1, message: '重复打招呼' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(adapter.greetJob(captured)).rejects.toThrow('重复打招呼')
  })

  it('handles HTTP error in sendFriendAddRequest', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-http-error.html?securityId=sec-http-error&lid=lid-http-error">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    document.cookie = 'bst=test-token'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockResolvedValue({}),
    })
    vi.stubGlobal('fetch', fetchMock)

    const adapter = new DomBossAdapter(document)
    const [captured] = await adapter.captureCurrentPage()

    await expect(adapter.greetJob(captured)).rejects.toThrow('500')
  })

  it('deduplicates jobs with same jobId', async () => {
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-dup-sec.html?securityId=dup-sec&lid=lid-dup-1">
        <span class="job-name">岗位 A</span>
        <span class="company-name">示例科技</span>
      </a>
      <a class="job-card-wrapper" href="/job_detail/job-dup-sec.html?securityId=dup-sec&lid=lid-dup-2">
        <span class="job-name">岗位 B</span>
        <span class="company-name">示例科技</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    expect(jobs).toHaveLength(1)
    expect(jobs[0].lid).toBe('lid-dup-1')
  })

  it('extracts raw recruiter name with "在线" prefix during capture', async () => {
    // The "在线" prefix is stripped only during enrichJob (detail parsing),
    // not during initial DOM capture
    document.body.innerHTML = `
      <a class="job-card-wrapper" href="/job_detail/job-online.html?securityId=sec-online&lid=lid-online">
        <span class="job-name">AI 产品经理</span>
        <span class="company-name">示例科技</span>
        <span class="boss-name">在线李经理</span>
        <span class="boss-title">技术总监</span>
      </a>
    `
    const adapter = new DomBossAdapter(document)
    const jobs = await adapter.captureCurrentPage()
    // During initial capture, recruiterName is raw from DOM
    expect(jobs[0].recruiterName).toBe('在线李经理')
  })
})
