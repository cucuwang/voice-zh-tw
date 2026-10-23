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

// 只有簡體才會出現的字：字典裡的簡體字，扣掉 Big5（cp950）也有、繁體文章本來就會用的字（干、台、里、著…）
const SHARED = new Set('万与丑丰么于云仆价优伙体余佣儿党凄准几凶划占厂厘台吁吃后吨听咨咸唇圣坏复夸宁尸岩岭岳峰帘干并庄床异征忏怀怜恒惊愿扑托扰挂据斗昵晒朴机杠杰极构柜栖栗气沄泞洁洒洼涂涌淀游灶炖熏瓮痒痴皂确离种秘筑篱粽网羡群肮肴胜腊腌膻苧苹范茧荐蒏蔂虫虮虱蚕蚝蜡蝎触赶跖辟适郁采里雇霉')
const SIMPLIFIED_ONLY = new Set(
  STCharacters.split('|')
    .map(pair => pair.split(' ')[0])
    .filter(ch => ch && !SHARED.has(ch)),
)

/** 文字裡是否含有只在簡體出現的字 */
export const hasSimplified = text => {
  for (const ch of text) {
    if (SIMPLIFIED_ONLY.has(ch)) return true
  }
  return false
}
