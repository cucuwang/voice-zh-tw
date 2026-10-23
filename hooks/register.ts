import type { Register } from 'claude-code'

// 簡體 → 台灣繁體，含台灣慣用詞（软件 → 軟體）
import { hasSimplified, toTaiwan } from './vendor/s2twp.js'

// 只轉 `text` 裡和 `known` 不同的那一段（聽寫進來的部分），其餘原樣保留。
// 那一段沒有簡體字就不動：打的繁體字（例如「文件」）不會被換成台灣用語
export const convertNew = (known: string, text: string): string => {
  let start = 0
  while (start < known.length && start < text.length && known[start] === text[start]) {
    start++
  }

  let end = 0
  while (
    end < known.length - start &&
    end < text.length - start &&
    known[known.length - 1 - end] === text[text.length - 1 - end]
  ) {
    end++
  }

  const middle = text.slice(start, text.length - end)

  if (!hasSimplified(middle)) {
    return text
  }

  return text.slice(0, start) + toTaiwan(middle) + text.slice(text.length - end)
}

export const register: Register = on => {
  // 輸入框裡「已知來源」的文字：打字、貼上、歷史紀錄、本 mod 換好的字
  let known = ''

  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    known = box.text

    return box
  })

  on('prompt.change', async ($, e, next) => {
    const result = await next(e)

    // 聽寫結果寫進輸入框時，engine 標記來源為 `engine`
    if (e.origin.kind !== 'engine') {
      known = e.text

      return result
    }

    const converted = convertNew(known, e.text)

    if (converted === e.text) {
      known = e.text

      return result
    }

    // 只在輸入框還是這段文字時才換；已經送出、清空就不寫回
    const box = await $.prompt.read()

    if (box.text === e.text) {
      known = converted
      await $.prompt.fill({ text: converted, mode: 'replace' })
    }

    return result
  })

  // 點一下模式聽寫完直接送出，不會先觸發 prompt.change：
  // 送出的文字裡不是打字、貼上或已換好的那段，就是聽寫內容，在這裡換
  on('prompt.submit', ($, e, next) => {
    if (e.command) {
      return next(e)
    }

    const text = e.text === known ? e.text : convertNew(known, e.text)
    known = ''

    return next(text === e.text ? e : { ...e, text })
  })
}

