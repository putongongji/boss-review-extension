import { describe, expect, it } from 'vitest'

import { createChatPayload } from '@/page/chatProtocol'

describe('createChatPayload', () => {
  it('creates a boss-helper compatible message object', () => {
    const payload = createChatPayload({
      fromUid: '100',
      toUid: '200',
      toName: 'encrypt-boss-id',
      content: '你好，想了解这个机会。',
    })

    expect(payload.args).toEqual({
      form_uid: '100',
      to_uid: '200',
      to_name: 'encrypt-boss-id',
      content: '你好，想了解这个机会。',
    })
    expect(ArrayBuffer.isView(payload.msg)).toBe(true)
    expect(payload.hex).toMatch(/^[0-9a-f]+$/)
    expect(payload.toArrayBuffer().byteLength).toBe(payload.msg.byteLength)
  })
})
