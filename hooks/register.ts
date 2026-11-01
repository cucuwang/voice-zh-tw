import type { Register } from 'claude-code'

// 簡體 → 台灣繁體，含台灣慣用詞（软件 → 軟體）
import { hasSimplified, toTaiwan } from './vendor/s2twp.js'

type Span = { prefix: string; suffix: string }

// 找出 `text` 裡和 `known` 不同的那一段（聽寫進來的部分）：回傳它前後保留不動的文字。
// `at` 是聽寫插入的位置（游標）：知道的話先用它找新增的那段，重複的字（软 + 软件）才不會認錯
const locate = (known: string, text: string, at?: number): Span => {
  const n = text.length - known.length
  if (at !== undefined && n > 0 && at >= 0 && at <= known.length &&
    text.slice(0, at) + text.slice(at + n) === known) {
    return { prefix: text.slice(0, at), suffix: text.slice(at + n) }
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

  return { prefix: text.slice(0, start), suffix: text.slice(text.length - end) }
}

const middleOf = (text: string, span: Span): string =>
  text.slice(span.prefix.length, text.length - span.suffix.length)

// 只轉 `text` 裡和 `known` 不同的那一段，其餘原樣保留。
// 那一段沒有簡體字就不動：打的繁體字（例如「文件」）不會被換成台灣用語。
export const convertNew = (known: string, text: string, at?: number): string => {
  const span = locate(known, text, at)
  const middle = middleOf(text, span)
  return hasSimplified(middle) ? span.prefix + toTaiwan(middle) + span.suffix : text
}

// 連續聽寫：按住模式會把同一段話分好幾次寫進輸入框（鼠 → 鼠标）。
// 上一次 engine 更新之後輸入框沒被別的事件動過，就記住這段的原始聽寫 `raw` 與畫面上的樣子 `shown`；
// 下一次更新若只是在這段後面接著寫，就用完整原文整段轉換，片語規則才會生效（鼠标 → 滑鼠）。
// 任何打斷（手動編輯、其他來源改動、寫回沒成功、送出、清空）都會清掉，回到只轉新增那段的做法。
type Run = Span & { raw: string; shown: string }

// 這次的文字是不是「在上一段聽寫尾端接著寫」：輸入框沒被動過（known 就是上次留下的樣子）、
// 前後文不變、插入位置正好在上一段尾端，且中間仍以上一段畫面開頭。是的話回傳整段的範圍與原文。
const extend = (run: Run | undefined, known: string, text: string, at: number | undefined) => {
  if (!run || known !== run.prefix + run.shown + run.suffix) return undefined
  if (at !== undefined && at !== run.prefix.length + run.shown.length) return undefined
  // 不知道插入位置時，只有上一段本來就在最尾端才算接著寫，避免把接在手打文字後面的新聽寫併進來
  if (at === undefined && run.suffix !== '') return undefined
  if (text.length < run.prefix.length + run.suffix.length ||
    !text.startsWith(run.prefix) || !text.endsWith(run.suffix)) return undefined
  const middle = middleOf(text, run)
  if (!middle.startsWith(run.shown)) return undefined
  return { span: { prefix: run.prefix, suffix: run.suffix }, raw: run.raw + middle.slice(run.shown.length) }
}

export const register: Register = on => {
  // 輸入框裡「已知來源」的文字：打字、貼上、歷史紀錄、本 mod 換好的字
  let known = ''
  let cursor: number | undefined
  let stashed = ''
  let run: Run | undefined
  // 連續聽寫被打斷的次數：寫回前的讀取等待期間若被打斷，處理完也不能把連續狀態設回來
  let breaks = 0
  const interrupt = () => { run = undefined; breaks++ }
  // 每次 edit／change 進來與寫入狀態時都加一：送出被擋下時，用它判斷等待期間有沒有新事件
  let version = 0

  on('prompt.edit', async ($, e, next) => {
    version++
    const box = await next(e)
    version++
    // 文字和游標都沒變的空操作不算打斷連續聽寫；以這次 edit 自己的前後狀態判斷，
    // 不用等待期間可能已被其他事件改掉的 known／cursor
    if (box.text !== e.text || box.cursor !== e.cursor) {
      interrupt()
    }
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
      // 本 mod 自己 fill 換好的文字：狀態本來就是這樣，連續聽寫照常延續
      const ownFill = e.origin.kind === 'plugin' && e.origin.name === 'voice-zh-tw' && e.text === known
      if (!ownFill) {
        interrupt()
      }
      stashed = e.origin.kind === 'clear' ? known : ''
      known = e.text
      cursor = e.cursor

      return result
    }

    const previous = run
    run = undefined

    const putBack = stashed !== '' && e.text === stashed
    stashed = ''
    if (putBack) {
      breaks++
      known = e.text
      cursor = e.cursor
      return result
    }
    const startBreaks = breaks

    const at = e.cursor - (e.text.length - known.length)
    // 在同一段聽寫尾端接著寫：拿整段原文來轉；否則照舊只轉新增的那段
    const extended = extend(previous, known, e.text, at)
    const span = extended ? extended.span : locate(known, e.text, at)
    const raw = extended ? extended.raw : middleOf(e.text, span)

    const shown = hasSimplified(raw) ? toTaiwan(raw) : middleOf(e.text, span)
    const converted = span.prefix + shown + span.suffix
    // 只有確定是「插入」的聽寫（拿掉這段就回到 known）或同段延續，才記成可延續的一段；
    // 改寫到既有文字的更新照舊只轉差異，不把差異範圍（可能含手打字）留作之後的原文
    const pureInsert = span.prefix + span.suffix === known
    const next_ = raw !== '' && (extended || pureInsert) ? { ...span, raw, shown } : undefined

    if (converted === e.text) {
      known = e.text
      cursor = e.cursor
      run = next_

      return result
    }

    // 只在輸入框還是這段文字時才換；已經送出、清空或使用者又打了字就不寫回，留給下一次更新或送出處理
    // 寫回前一刻再讀一次：讀取期間使用者又打了字就放棄，不讓整框取代蓋掉新輸入。
    // SDK 的 fill 只有整框取代、沒有條件式寫入，最後一次讀取到寫回之間仍有極短空檔
    const box = await $.prompt.read()
    const again = box.text === e.text ? await $.prompt.read() : box

    if (box.text === e.text && again.text === e.text) {
      known = converted
      cursor = undefined
      run = breaks === startBreaks ? next_ : undefined
      const filled = await $.prompt.fill({ text: converted, mode: 'replace' })
      // 寫回沒成功就不延續這段，避免下次拿不存在的畫面當基準
      if (filled && filled.isFilled === false && run === next_) {
        run = undefined
      }
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

    const previous = run
    interrupt()

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
    // 點一下模式接在按住模式的同一段聽寫後面送出時，也用整段原文轉（软件 接 打印 → 軟體列印）
    const extended = e.text === known ? undefined : extend(previous, known, e.text, cursor)
    const text = e.text === known ? e.text
      : extended ? extended.span.prefix + (hasSimplified(extended.raw) ? toTaiwan(extended.raw) : middleOf(e.text, extended.span)) + extended.span.suffix
      : convertNew(known, e.text, cursor)
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
