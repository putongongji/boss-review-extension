import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script'

import { createChatPayload } from '@/page/chatProtocol'

interface CustomGreetingRequest {
  type: 'BRS_SEND_CUSTOM_GREETING'
  requestId: string
  toUid: string
  toName: string
  content: string
}

interface VueJobsRequest {
  type: 'BRS_GET_VUE_JOBS'
  requestId: string
}

interface VueDetailRequest {
  type: 'BRS_GET_VUE_DETAIL'
  requestId: string
  jobId: string
}

interface VueJobItem {
  securityId?: string
  encryptBossId?: string
  bossName?: string
  bossTitle?: string
  encryptJobId?: string
  expectId?: number
  jobName?: string
  lid?: string
  salaryDesc?: string
  jobLabels?: string[]
  skills?: string[]
  jobExperience?: string
  jobDegree?: string
  cityName?: string
  areaDistrict?: string
  businessDistrict?: string
  brandName?: string
  welfareList?: string[]
}

interface VueJobDetail {
  securityId?: string
  sessionId?: string
  lid?: string
  jobInfo?: {
    encryptId?: string
    encryptUserId?: string
    jobName?: string
    salaryDesc?: string
    locationName?: string
    experienceName?: string
    degreeName?: string
    showSkills?: string[]
    postDescription?: string
    address?: string
  }
  bossInfo?: {
    name?: string
    title?: string
  }
  brandComInfo?: {
    brandName?: string
  }
}

interface PageVue {
  jobList?: VueJobItem[]
  jobDetail?: VueJobDetail
  clickJobCardAction?: (item: VueJobItem) => unknown
}

export default defineUnlistedScript(() => {
  document.documentElement.setAttribute('data-boss-review-bridge', 'ready')

  window.addEventListener('message', async (event) => {
    const data = event.data as Partial<CustomGreetingRequest | VueJobsRequest | VueDetailRequest>
    if (!data?.type) return

    try {
      if (data.type === 'BRS_SEND_CUSTOM_GREETING') {
        await handleCustomGreeting(data)
        return
      }
      if (data.type === 'BRS_GET_VUE_JOBS') {
        respond(data.requestId, true, readVueJobs())
        return
      }
      if (data.type === 'BRS_GET_VUE_DETAIL') {
        respond(data.requestId, true, await readVueDetail(data.jobId ?? ''))
      }
    } catch (error) {
      const errorMessage = describeError(error)
      console.error('[Boss助手] 页面桥处理失败:', data.type, errorMessage, error)
      if (data.type === 'BRS_SEND_CUSTOM_GREETING') {
        respondCustomGreeting(data.requestId, false, errorMessage, _sendLogs)
        return
      }
      respond(data.requestId, false, null, errorMessage)
    }
  })
})

let _sendLogs: string[] = []

async function handleCustomGreeting(data: Partial<CustomGreetingRequest>): Promise<void> {
  _sendLogs = []
  const fromUid = getCurrentUserId()
  if (!fromUid) {
    throw new Error('没有获取到当前 Boss 用户 ID')
  }
  if (!data.toUid || !data.toName || !data.content) {
    throw new Error('缺少聊天发送参数')
  }

  const payload = createChatPayload({
    fromUid,
    toUid: data.toUid,
    toName: data.toName,
    content: data.content,
  })
  _sendLogs.push(`payload hex 长度=${payload.hex.length}`)
  console.log('[Boss助手] 发送自定义消息:', { toUid: data.toUid, toName: data.toName })
  await sendPayload(payload)
  console.log('[Boss助手] 自定义消息发送完成，通知调用方')
  respondCustomGreeting(data.requestId, true, undefined, _sendLogs)
}

function respondCustomGreeting(requestId: string | undefined, ok: boolean, error?: string, detail?: string[]): void {
  if (!requestId) return

  window.postMessage(
    {
      type: 'BRS_SEND_CUSTOM_GREETING_RESULT',
      requestId,
      ok,
      error,
      detail: detail?.join('｜'),
    },
    '*',
  )
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try { return JSON.stringify(error) } catch { return String(error) }
}

function respond(requestId: string | undefined, ok: boolean, payload?: unknown, error?: string): void {
  if (!requestId) return

  window.postMessage(
    {
      type: 'BRS_PAGE_BRIDGE_RESULT',
      requestId,
      ok,
      payload,
      error,
    },
    '*',
  )
}

function readVueJobs(): unknown[] {
  return getVueJobList().map(normalizeVueJob).filter((job) => Boolean(job.jobId))
}

async function readVueDetail(jobId: string): Promise<unknown> {
  if (!jobId) {
    throw new Error('缺少岗位 ID')
  }

  const pageVue = await waitForPageVue()
  const item = getVueJobList(pageVue).find((job) => job.encryptJobId === jobId)
  const current = normalizeVueDetail(pageVue.jobDetail)
  if (current.jobId === jobId) {
    return current
  }

  if (item && pageVue.clickJobCardAction) {
    await Promise.resolve(pageVue.clickJobCardAction.call(pageVue, item))
  }

  const detail = await waitForVueDetail(jobId, item?.lid)
  return normalizeVueDetail(detail)
}

async function waitForPageVue(): Promise<PageVue> {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const pageVue = findPageVue()
    if (pageVue) {
      return pageVue
    }
    await sleep(100)
  }

  throw new Error('未找到 Boss 页面 Vue 数据')
}

function findPageVue(): PageVue | null {
  const selectors = ['#wrap .page-job-wrapper', '.job-recommend-main', '.page-jobs-main']
  for (const selector of selectors) {
    const element = document.querySelector(selector) as (Element & { __vue__?: PageVue }) | null
    if (element?.__vue__) {
      return element.__vue__
    }
  }

  return null
}

function getVueJobList(pageVue = findPageVue()): VueJobItem[] {
  const jobList = pageVue?.jobList
  return Array.isArray(jobList) ? jobList : []
}

async function waitForVueDetail(jobId: string, lid?: string): Promise<VueJobDetail> {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    const detail = findPageVue()?.jobDetail
    if (detailMatches(detail, jobId, lid)) {
      return detail
    }
    await sleep(100)
  }

  throw new Error('Boss Vue 详情读取超时')
}

function detailMatches(detail: VueJobDetail | undefined, jobId: string, lid?: string): detail is VueJobDetail {
  if (!detail) return false
  return detail.jobInfo?.encryptId === jobId || Boolean(lid && detail.lid === lid)
}

function normalizeVueJob(item: VueJobItem): Record<string, unknown> {
  return compact({
    jobId: item.encryptJobId,
    securityId: item.securityId,
    lid: item.lid,
    title: item.jobName,
    company: item.brandName,
    salary: item.salaryDesc,
    location: [item.cityName, item.areaDistrict, item.businessDistrict].filter(Boolean).join(' '),
    experience: item.jobExperience || pickExperience(item.jobLabels ?? []),
    degree: item.jobDegree || pickDegree(item.jobLabels ?? []),
    recruiterName: item.bossName,
    recruiterTitle: item.bossTitle,
    recruiterId: item.encryptBossId,
    encryptBossId: item.encryptBossId,
    skills: unique([...(item.skills ?? []), ...(item.jobLabels ?? [])]),
    welfare: item.welfareList ?? [],
    sourceUrl: `/job_detail/${item.encryptJobId}.html?securityId=${encodeURIComponent(item.securityId ?? '')}&lid=${encodeURIComponent(item.lid ?? '')}`,
  })
}

function normalizeVueDetail(detail: VueJobDetail | undefined): Record<string, unknown> {
  const jobInfo = detail?.jobInfo
  return compact({
    jobId: jobInfo?.encryptId,
    securityId: detail?.securityId,
    lid: detail?.lid,
    title: jobInfo?.jobName,
    company: detail?.brandComInfo?.brandName,
    salary: jobInfo?.salaryDesc,
    location: jobInfo?.locationName,
    workAddress: jobInfo?.address,
    experience: jobInfo?.experienceName,
    degree: jobInfo?.degreeName,
    recruiterName: detail?.bossInfo?.name,
    recruiterTitle: detail?.bossInfo?.title,
    recruiterId: jobInfo?.encryptUserId,
    encryptBossId: jobInfo?.encryptUserId,
    skills: jobInfo?.showSkills ?? [],
    jdText: normalizeMultilineText(jobInfo?.postDescription),
    sourceUrl: `/job_detail/${jobInfo?.encryptId ?? ''}.html?securityId=${encodeURIComponent(detail?.securityId ?? '')}&lid=${encodeURIComponent(detail?.lid ?? '')}`,
  })
}

function pickExperience(tags: string[]): string {
  return tags.find((tag) => /经验|年|应届|在校|不限/.test(tag)) ?? ''
}

function pickDegree(tags: string[]): string {
  return tags.find((tag) => /博士|硕士|本科|大专|中专|高中|学历不限|不限/.test(tag)) ?? ''
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function compact(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0
    return Boolean(value)
  }))
}

function normalizeMultilineText(value: string | undefined): string {
  return (value ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getCurrentUserId(): string {
  const page = (window as unknown as { _PAGE?: { uid?: string | number; userId?: string | number } })._PAGE
  return String(page?.uid ?? page?.userId ?? '')
}

// boss-helper 风格的 Message 对象：ChatWebsocket.send(message) 接收整个 Message，
// 内部调用 message.toArrayBuffer() 得到 ArrayBuffer 再交给 Paho MQTT。
// 关键：msg（Uint8Array）必须在 iframe 的 JS 上下文中创建，否则 Paho 的
// `instanceof ArrayBuffer` 检查会因为跨 Realm 而失败（AMQJS0013E 错误）。
interface IframeMessage {
  msg: Uint8Array
  hex: string
  args: Record<string, string>
  toArrayBuffer(): ArrayBuffer
}

async function sendPayload(payload: { msg: Uint8Array; hex: string; args: Record<string, string> }): Promise<void> {
  _sendLogs.push(`payload hex 长度=${payload.hex.length}`)

  // 路径A：主窗口 ChatWebsocket（boss-helper 首选方案）
  const mainChatWs = (window as Record<string, unknown>).ChatWebsocket as { send?: (msg: unknown) => void } | undefined
  if (mainChatWs?.send) {
    _sendLogs.push('路径A: 主窗口 ChatWebsocket→send(message)')
    mainChatWs.send(payload)
    _sendLogs.push('主窗口 ChatWebsocket send 返回成功')
    return
  }

  // 路径B：主窗口 GeekChatCore（打招乎列表页可能未初始化，直接跳过）
  try {
    const gcc = (window as Record<string, unknown>).GeekChatCore as {
      getInstance?: () => { getClient?: () => { send?: (msg: unknown) => void } } | undefined
    } | undefined
    const instance = gcc?.getInstance?.()
    const client = instance?.getClient?.()
    if (client?.send) {
      _sendLogs.push('路径B: 主窗口 GeekChatCore client→send(message)')
      client.send(payload)
      _sendLogs.push('主窗口 GeekChatCore send 返回成功')
      return
    }
    _sendLogs.push('路径B跳过: GeekChatCore 未初始化')
  } catch (e) {
    _sendLogs.push(`路径B跳过: ${describeError(e)}`)
  }

  // 路径C：加载隐藏聊天页 iframe，使用其 ChatWebsocket
  _sendLogs.push('路径C: 加载聊天页 iframe')
  const iframeWindow = await getOrCreateChatFrameWindow()

  // 等 ChatWebsocket 准备就绪
  const chatWs = await waitForChatWebsocketReady(iframeWindow)

  // 等 WebSocket 连接建立（有 isConnected 就轮询，没有就固定等 5s）
  await waitForWebSocketConnected(chatWs)

  // 在 iframe 上下文中构造 Message 对象 —— 这是关键！
  // msg（Uint8Array）必须在 iframe 的 JS Realm 中创建，否则 Paho 的 instanceof 检查失败。
  const iframeMsg = buildIframeMessage(iframeWindow, payload.hex, payload.args)
  _sendLogs.push(`iframe message ready, msg.byteLength=${iframeMsg.msg.byteLength}`)

  // boss-helper 风格：ChatWebsocket.send(messageObject)
  chatWs.send(iframeMsg)
  _sendLogs.push('iframe ChatWebsocket.send(message) 返回成功')
}

/** 在 iframe 中等待 ChatWebsocket 就绪 */
function waitForChatWebsocketReady(iframeWindow: Window): Promise<{ send(msg: unknown): void }> {
  const iframeWin = iframeWindow as Record<string, unknown>
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 15000
    let attempts = 0
    function poll() {
      attempts++
      const cws = iframeWin.ChatWebsocket as { send?: (msg: unknown) => void } | undefined
      if (cws?.send) {
        _sendLogs.push(`iframe ChatWebsocket 就绪(${attempts}次)`)
        resolve(cws)
        return
      }
      if (Date.now() > deadline) {
        reject(new Error(`iframe ChatWebsocket 未就绪(${attempts}次)`))
        return
      }
      window.setTimeout(poll, 200)
    }
    poll()
  })
}

/** 等待 WebSocket 连接建立 */
async function waitForWebSocketConnected(chatWs: { send(msg: unknown): void }): Promise<void> {
  const conn = (chatWs as Record<string, unknown>).connection as { isConnected?: () => boolean } | undefined
  if (typeof conn?.isConnected === 'function') {
    const deadline = Date.now() + 15000
    let attempts = 0
    return new Promise((resolve) => {
      function poll() {
        attempts++
        try {
          if (conn!.isConnected!()) {
            _sendLogs.push(`WebSocket 已连接(${attempts}次)`)
            resolve()
            return
          }
        } catch { /* ignore */ }
        if (Date.now() > deadline) {
          _sendLogs.push(`WebSocket 连接超时(${attempts}次)，继续发送`)
          resolve()
          return
        }
        window.setTimeout(poll, 300)
      }
      poll()
    })
  }
  // 没有 isConnected 方法，固定等 5 秒让 WebSocket 建立
  _sendLogs.push('无 isConnected，等 5s 稳定 WebSocket 连接')
  await sleep(5000)
}

/** 在 iframe 的 JS 上下文中构造完整的 Message 对象。
 *  这是解决 AMQJS0013E（跨 Realm instanceof）错误的核心。
 *  boss-helper 所有代码都在同一上下文运行，不存在此问题；
 *  我们从主窗口操作 iframe，必须显式在 iframe 中创建 TypedArray。 */
function buildIframeMessage(
  iframeWindow: Window,
  hex: string,
  args: Record<string, string>,
): IframeMessage {
  const iframeWin = iframeWindow as Record<string, unknown> & {
    ArrayBuffer: typeof ArrayBuffer
    Uint8Array: typeof Uint8Array
  }
  const len = hex.length / 2
  const buf = new iframeWin.ArrayBuffer(len)
  const msg = new iframeWin.Uint8Array(buf)
  for (let i = 0; i < len; i++) {
    msg[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }

  return {
    msg,
    hex,
    args,
    toArrayBuffer(): ArrayBuffer {
      // this.msg 是 iframe 上下文的 Uint8Array，.buffer.slice() 返回的也是 iframe 上下文的 ArrayBuffer
      return (this.msg as Uint8Array).buffer.slice(0, (this.msg as Uint8Array).byteLength)
    },
  }
}

/** 创建/获取隐藏聊天页 iframe */
async function getOrCreateChatFrameWindow(): Promise<Window> {
  const id = 'boss-review-sender-chat-frame'
  const existing = document.getElementById(id) as HTMLIFrameElement | null
  if (existing?.contentWindow) {
    _sendLogs.push('iframe 已存在')
    return existing.contentWindow
  }

  const iframe = document.createElement('iframe')
  iframe.id = id
  iframe.src = 'https://www.zhipin.com/web/geek/chat'
  iframe.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;'
  document.body.append(iframe)

  console.log('[Boss助手] 等待隐藏 iframe 加载...')
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      _sendLogs.push('iframe 加载超时(12s)')
      reject(new Error('隐藏聊天页加载超时'))
    }, 12000)
    iframe.addEventListener(
      'load',
      () => {
        window.clearTimeout(timeout)
        _sendLogs.push('iframe 已加载')
        console.log('[Boss助手] 隐藏 iframe 已加载')
        resolve()
      },
      { once: true },
    )
  })
  if (!iframe.contentWindow) {
    _sendLogs.push('iframe contentWindow 为空')
    throw new Error('隐藏聊天页不可用')
  }

  // 诊断：确认 iframe 内皮全局变量
  const iframeWin = iframe.contentWindow as Record<string, unknown>
  _sendLogs.push(`iframe→ChatWebsocket=${typeof iframeWin.ChatWebsocket}`)
  _sendLogs.push(`iframe→GeekChatCore=${typeof iframeWin.GeekChatCore}`)

  return iframe.contentWindow
}

