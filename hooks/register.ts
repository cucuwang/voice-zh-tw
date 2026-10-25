import type { Register } from 'claude-code'

// 簡體 → 台灣繁體，含台灣慣用詞（软件 → 軟體）
import { hasSimplified, toTaiwan } from './vendor/s2twp.js'

// 只轉 `text` 裡和 `known` 不同的那一段（聽寫進來的部分），其餘原樣保留。
// 那一段沒有簡體字就不動：打的繁體字（例如「文件」）不會被換成台灣用語。
// `at` 是聽寫插入的位置（游標）：知道的話先用它找新增的那段，重複的字（软 + 软件）才不會認錯
export const convertNew = (known: string, text: string, at?: number): string => {
  const n = text.length - known.length
  if (at !== undefined && n > 0 && at >= 0 && at <= known.length &&
    text.slice(0, at) + text.slice(at + n) === known) {
    const inserted = text.slice(at, at + n)
    return hasSimplified(inserted)
      ? text.slice(0, at) + toTaiwan(inserted) + text.slice(at + n)
      : text
  }

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
  let cursor: number | undefined
  let stashed = ''
  // 每次 edit／change 進來與寫入狀態時都加一：送出被擋下時，用它判斷等待期間有沒有新事件
  let version = 0

  on('prompt.edit', async ($, e, next) => {
    version++
    const box = await next(e)
    version++
    known = box.text
    cursor = box.cursor
    stashed = ''

    return box
  })

  on('prompt.change', async ($, e, next) => {
    version++
    const result = await next(e)
    version++

    // 聽寫結果寫進輸入框時，engine 標記來源為 `engine`
    if (e.origin.kind !== 'engine') {
      stashed = e.origin.kind === 'clear' ? known : ''
      known = e.text
      cursor = e.cursor

      return result
    }

    const putBack = stashed !== '' && e.text === stashed
    stashed = ''
    if (putBack) {
      known = e.text
      cursor = e.cursor
      return result
    }

    const converted = convertNew(known, e.text, e.cursor - (e.text.length - known.length))

    if (converted === e.text) {
      known = e.text
      cursor = e.cursor

      return result
    }

    // 只在輸入框還是這段文字時才換；已經送出、清空就不寫回
    const box = await $.prompt.read()

    if (box.text === e.text) {
      known = converted
      cursor = undefined
      await $.prompt.fill({ text: converted, mode: 'replace' })
    }

    return result
  })

  // 點一下模式聽寫完直接送出，不會先觸發 prompt.change：
  // 送出的文字裡不是打字、貼上或已換好的那段，就是聽寫內容，在這裡換
  on('prompt.submit', async ($, e, next) => {
    // 不是從這個輸入框送出的（插件、遠端、排程、通知…）不轉，也不動輸入框的狀態
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'unclassified') {
      return next(e)
    }

    // clear 後直接送出原草稿，視為草稿放回；不管有沒有對上、送的是不是指令，記住的草稿只用這一次
    const putBack = stashed !== '' && e.text === stashed
    stashed = ''

    if (e.command) {
      return next(e)
    }

    if (putBack) {
      known = e.text
      cursor = undefined
    }

    const before = known
    const beforeCursor = cursor
    const text = e.text === known ? e.text : convertNew(known, e.text, cursor)
    known = ''
    cursor = undefined

    // 送出被擋下（drop）時框裡還是原文，等待期間沒有新的 edit/change 才還原，重試時才不會把打的字當聽寫
    const v = version
    const result = await next(text === e.text ? e : { ...e, text })
    if (result.drop !== undefined && version === v) {
      known = before
      cursor = beforeCursor
    }

    return result
  })
}

