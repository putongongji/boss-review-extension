import protobuf from 'protobufjs'

interface ChatMessageInput {
  fromUid: string
  toUid: string
  toName: string
  content: string
}

interface ChatMessageArgs {
  form_uid: string
  to_uid: string
  to_name: string
  content: string
}

export interface ChatPayload {
  msg: Uint8Array
  hex: string
  args: ChatMessageArgs
  toArrayBuffer(): ArrayBuffer
}

const root = new protobuf.Root()
  .define('cn.techwolf.boss.chat')
  .add(
    new protobuf.Type('TechwolfUser')
      .add(new protobuf.Field('uid', 1, 'int64'))
      .add(new protobuf.Field('name', 2, 'string', 'optional'))
      .add(new protobuf.Field('source', 7, 'int32', 'optional')),
  )
  .add(
    new protobuf.Type('TechwolfMessageBody')
      .add(new protobuf.Field('type', 1, 'int32'))
      .add(new protobuf.Field('templateId', 2, 'int32', 'optional'))
      .add(new protobuf.Field('headTitle', 11, 'string', 'optional'))
      .add(new protobuf.Field('text', 3, 'string', 'optional')),
  )
  .add(
    new protobuf.Type('TechwolfMessage')
      .add(new protobuf.Field('from', 1, 'TechwolfUser'))
      .add(new protobuf.Field('to', 2, 'TechwolfUser'))
      .add(new protobuf.Field('type', 3, 'int32'))
      .add(new protobuf.Field('mid', 4, 'int64', 'optional'))
      .add(new protobuf.Field('time', 5, 'int64', 'optional'))
      .add(new protobuf.Field('body', 6, 'TechwolfMessageBody'))
      .add(new protobuf.Field('cmid', 11, 'int64', 'optional')),
  )
  .add(
    new protobuf.Type('TechwolfChatProtocol')
      .add(new protobuf.Field('type', 1, 'int32'))
      .add(new protobuf.Field('messages', 3, 'TechwolfMessage', 'repeated')),
  )

const ChatProtocol = root.lookupType('TechwolfChatProtocol')

export function createChatPayload(input: ChatMessageInput): ChatPayload {
  const now = Date.now()
  const messageId = String(now + 68256432452609)
  const args = {
    form_uid: input.fromUid,
    to_uid: input.toUid,
    to_name: input.toName,
    content: input.content,
  }
  const payload = ChatProtocol.create({
    type: 1,
    messages: [
      {
        from: { uid: input.fromUid, source: 0 },
        to: { uid: input.toUid, name: input.toName, source: 0 },
        type: 1,
        mid: messageId,
        time: String(now),
        cmid: messageId,
        body: {
          type: 1,
          templateId: 1,
          text: input.content,
        },
      },
    ],
  })
  const bytes = ChatProtocol.encode(payload).finish().slice()

  return {
    msg: bytes,
    hex: [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
    args,
    toArrayBuffer() {
      return bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer
    },
  }
}
