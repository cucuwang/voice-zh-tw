import type { PromptChangeInput, PromptChangeResult } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// 型別沒有公開 $.prompt.change（只由 engine 觸發），測試裡用轉型觸發它
type Raise = { prompt: { change: (e: PromptChangeInput) => Promise<PromptChangeResult> } }
const change = ($: unknown, e: PromptChangeInput) => ($ as Raise).prompt.change(e)

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
  await change($, { text: cn, cursor: cn.length, origin: { kind: 'plugin', name: 'voice-zh-tw' } })

  expect(fills).toEqual([])
})
