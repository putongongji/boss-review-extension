export function findBossVueRoot(doc: Document = document): unknown | null {
  const wrap = doc.querySelector<HTMLElement>('#wrap')
  return wrap && '__vue__' in wrap ? (wrap as HTMLElement & { __vue__?: unknown }).__vue__ ?? null : null
}

export function isVerificationVisible(doc: Document = document): boolean {
  const text = doc.body.textContent ?? ''
  return ['验证码', '安全验证', '登录异常', '操作过于频繁'].some((keyword) => text.includes(keyword))
}
