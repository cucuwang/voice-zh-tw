/** 簡體 → 台灣繁體，含台灣慣用詞（OpenCC s2twp）。 */
export declare const toTaiwan: (text: string) => string
/** 文字裡是否含有簡體字（只比對字形，不含用語轉換）。 */
export declare const hasSimplified: (text: string) => boolean
