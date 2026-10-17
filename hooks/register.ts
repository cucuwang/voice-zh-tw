import type { Register } from 'claude-code'

// 簡體 → 台灣繁體，含台灣慣用詞（软件 → 軟體）
import { toTaiwan } from './vendor/s2twp.js'

const NAME = 'voice-zh-tw'

// 最近一次聽寫：engine 寫進輸入框的原文、轉換後的文字、是否已被送出
type Pending = { raw: string; converted: string; isSubmitted: boolean }

export const register: Register = on => {
  let pending: Pending | undefined

  on('prompt.change', async ($, e, next) => {
    // 本 mod 自己的 fill 落地。若訊息已先送出，這份繁體是多出來的，清掉
    if (e.origin.kind === 'plugin' && e.origin.name === NAME) {
      const result = await next(e)
      const p = pending

      if (p?.isSubmitted && e.text === p.converted) {
        pending = undefined
        await $.prompt.fill({ text: '', mode: 'replace' })
      }

      return result
    }

    // 聽寫結果寫進輸入框時，engine 標記來源為 `engine`。
    // 自己打字走 prompt.edit、貼上也是，不會被轉。
    if (e.origin.kind !== 'engine') {
      return next(e)
    }

    const converted = toTaiwan(e.text)

    if (converted === e.text) {
      return next(e)
    }

    const p: Pending = { raw: e.text, converted, isSubmitted: false }
    pending = p

    const result = await next(e)

    // 點一下模式可能在換字前就送出了；送出時已換好，不再寫回輸入框
    if (!p.isSubmitted) {
      await $.prompt.fill({ text: converted, mode: 'replace' })
    }

    return result
  })

  // 保險：送出的文字若還含剛聽寫、尚未轉換的原文，只換掉那一段
  on('prompt.submit', ($, e, next) => {
    const p = pending

    if (!p || e.command || p.isSubmitted) {
      return next(e)
    }

    if (e.text.includes(p.raw)) {
      p.isSubmitted = true

      return next({ ...e, text: e.text.replace(p.raw, p.converted) })
    }

    if (e.text.includes(p.converted)) {
      pending = undefined
    }

    return next(e)
  })
}
