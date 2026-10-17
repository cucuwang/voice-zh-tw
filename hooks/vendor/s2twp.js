// 組合 opencc-js 1.0.5（MIT，見 OPENCC-JS-LICENSE.txt）的 cn → twp 轉換：
// 先簡轉繁（字＋詞），再轉台灣用字與用語。
import { ConverterFactory } from './core.js'
import STCharacters from './dict/STCharacters.js'
import STPhrases from './dict/STPhrases.js'
import TWVariants from './dict/TWVariants.js'
import TWPhrasesIT from './dict/TWPhrasesIT.js'
import TWPhrasesName from './dict/TWPhrasesName.js'
import TWPhrasesOther from './dict/TWPhrasesOther.js'

export const toTaiwan = ConverterFactory(
  [STCharacters, STPhrases],
  [TWVariants, TWPhrasesIT, TWPhrasesName, TWPhrasesOther],
)
