import { describe, expect, it, vi } from 'vitest'

import { copyAndFocusBossInput } from '@/page/sender'

describe('copyAndFocusBossInput', () => {
  it('copies greeting and focuses textarea', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    document.body.innerHTML = `<textarea class="chat-input"></textarea>`

    const result = await copyAndFocusBossInput('你好，想进一步沟通。', document)

    expect(result.ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('你好，想进一步沟通。')
    expect(document.activeElement).toBe(document.querySelector('textarea'))
  })
})
