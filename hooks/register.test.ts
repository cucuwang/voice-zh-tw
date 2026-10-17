import type { PromptChangeInput, PromptChangeResult, PromptSubmitInput, PromptSubmitResult } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// 型別沒有公開 $.prompt.change（只由 engine 觸發），測試裡用轉型觸發它
type Raise = {
  prompt: {
    change: (e: PromptChangeInput) => Promise<PromptChangeResult>
    submit: (e: PromptSubmitInput) => Promise<PromptSubmitResult>
  }
}
const change = ($: unknown, e: PromptChangeInput) => ($ as Raise).prompt.change(e)
const submit = ($: unknown, text: string) =>
  ($ as Raise).prompt.submit({ text, wait: false, origin: { kind: 'composer' } })

test('聽寫進來的簡體會換成台灣繁體', async ($, on) => {
  const fills: string[] = []
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  const text = '我现在讲的是繁体中文，帮我检查软件的内存设置'
  await change($, { text, cursor: text.length, origin: { kind: 'engine' } })

  expect(fills).toEqual(['我現在講的是繁體中文，幫我檢查軟體的記憶體設定'])
})

test('已經是繁體、或不是聽寫來源時不動', async ($, on) => {
  const fills: string[] = []
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  const tw = '這已經是繁體 hello'
  await change($, { text: tw, cursor: tw.length, origin: { kind: 'engine' } })
  const cn = '历史记录里的简体'
  await change($, { text: cn, cursor: cn.length, origin: { kind: 'history' } })

  expect(fills).toEqual([])
})

test('換字前就送出時：送出的是繁體，且不再寫回輸入框', async ($, on) => {
  const fills: string[] = []
  const sent: string[] = []
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  // 模擬點一下模式：engine 寫入後、mod 換字前，訊息就送出了
  let reached: () => void = () => {}
  let release: () => void = () => {}
  const isReached = new Promise<void>(r => (reached = r))
  const gate = new Promise<void>(r => (release = r))
  on('prompt.change', async ($, e) => {
    if (e.origin.kind === 'engine') {
      reached()
      await gate
    }
    return { text: e.text }
  })
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  const text = 'Hello，帮我看一下这个'
  const changing = change($, { text, cursor: text.length, origin: { kind: 'engine' } })
  await isReached
  await submit($, text)
  release()
  await changing

  expect(sent).toEqual(['Hello，幫我看一下這個'])
  expect(fills).toEqual([])
})

test('fill 落在送出之後：把多出來的繁體清掉', async ($, on) => {
  const fills: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  const raw = '帮我看一下'
  const converted = '幫我看一下'
  // 送出在 change 的 next 之後、fill 之前無法在測試裡精確卡位，
  // 這裡用順序重現：engine 寫入 → 送出原文 → 本 mod 的 fill 落地
  await change($, { text: raw, cursor: raw.length, origin: { kind: 'engine' } })
  await submit($, raw)
  await change($, { text: converted, cursor: converted.length, origin: { kind: 'plugin', name: 'voice-zh-tw' } })

  expect(fills).toEqual([converted, ''])
})

test('貼上的簡體（非聽寫）送出時不轉', async ($, on) => {
  const sent: string[] = []
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await submit($, '这是我贴上的简体稿')

  expect(sent).toEqual(['这是我贴上的简体稿'])
})
