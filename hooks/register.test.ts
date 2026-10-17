import type {
  PromptChangeInput,
  PromptChangeResult,
  PromptEditInput,
  PromptEditResult,
  PromptSubmitInput,
  PromptSubmitResult,
} from 'claude-code'
import { expect, test } from 'claude-code/testing'

// 型別沒有公開這幾個 engine 觸發的事件，測試裡用轉型觸發
type Raise = {
  prompt: {
    change: (e: PromptChangeInput) => Promise<PromptChangeResult>
    edit: (e: PromptEditInput) => Promise<PromptEditResult>
    submit: (e: PromptSubmitInput) => Promise<PromptSubmitResult>
  }
}
const raise = ($: unknown) => ($ as Raise).prompt
const dictate = ($: unknown, text: string) =>
  raise($).change({ text, cursor: text.length, origin: { kind: 'engine' } })
const submit = ($: unknown, text: string) =>
  raise($).submit({ text, wait: false, origin: { kind: 'composer' } })
// 一次打字或貼上：從 before 變成 before + inserted
const type = ($: unknown, before: string, inserted: string) =>
  raise($).edit({
    text: before,
    cursor: before.length,
    start: before.length,
    end: before.length,
    inputText: inserted,
    origin: { kind: 'composer' },
  } as PromptEditInput)

test('聽寫進來的簡體會換成台灣繁體', async ($, on) => {
  const fills: string[] = []
  let box = ''
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  box = '我现在讲的是繁体中文，帮我检查软件的内存设置'
  await dictate($, box)

  expect(fills).toEqual(['我現在講的是繁體中文，幫我檢查軟體的記憶體設定'])
})

test('點一下模式先送出：送出的是繁體', async ($, on) => {
  const sent: string[] = []
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await submit($, 'Hello，帮我看一下这个')

  expect(sent).toEqual(['Hello，幫我看一下這個'])
})

test('送出後才收到聽寫通知：輸入框已清空，不寫回', async ($, on) => {
  const fills: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })

  await submit($, '测试测试')
  await dictate($, '测试测试')

  expect(fills).toEqual([])
})

test('先打字再接聽寫：只轉聽寫那段，打的字不動', async ($, on) => {
  const sent: string[] = []
  on('prompt.edit', ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await type($, '', '这段是我打的：')
  await submit($, '这段是我打的：帮我看一下这个')

  expect(sent).toEqual(['这段是我打的：幫我看一下這個'])
})

test('貼上的簡體（非聽寫）送出時不轉', async ($, on) => {
  const sent: string[] = []
  on('prompt.edit', ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await type($, '', '这是我贴上的简体稿')
  await submit($, '这是我贴上的简体稿')

  expect(sent).toEqual(['这是我贴上的简体稿'])
})

test('歷史紀錄叫回的簡體不轉', async ($, on) => {
  const fills: string[] = []
  const sent: string[] = []
  on('prompt.change', ($, e) => ({ text: e.text }))
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  const old = '历史记录里的简体'
  await raise($).change({ text: old, cursor: old.length, origin: { kind: 'history' } })
  await submit($, old)

  expect(fills).toEqual([])
  expect(sent).toEqual([old])
})
