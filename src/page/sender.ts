export interface SendResult {
  ok: boolean
  mode: 'copy-focus'
  message: string
}

export async function copyAndFocusBossInput(greeting: string, doc: Document = document): Promise<SendResult> {
  await navigator.clipboard.writeText(greeting)

  const input = doc.querySelector<HTMLElement>(
    'textarea, [contenteditable="true"], .chat-input, [class*="chat"] textarea',
  )

  input?.focus()

  return {
    ok: true,
    mode: 'copy-focus',
    message: input ? '已复制并聚焦输入框，请手动确认发送。' : '已复制打招呼语，请手动粘贴发送。',
  }
}
