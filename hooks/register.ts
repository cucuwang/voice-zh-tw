import type { Register } from 'claude-code'

// 簡體 → 台灣繁體，含台灣慣用詞（软件 → 軟體）
import { toTaiwan } from './vendor/s2twp.js'

export const register: Register = on => {
  // 聽寫結果寫進輸入框時，engine 標記來源為 `engine`。
  // 自己打字走 prompt.edit、貼上也是，不會被轉；本 mod 的 fill 來源是 `plugin`，不會迴圈。
  on('prompt.change', { origin: { kind: 'engine' } }, async ($, e, next) => {
    const result = await next(e)
    const converted = toTaiwan(e.text)

    if (converted !== e.text) {
      await $.prompt.fill({ text: converted, mode: 'replace' })
    }

    return result
  })
}
