/** Lightweight UI string translations for the form viewer. */

const UI_STRINGS: Record<string, Record<string, string>> = {
  originalDocument: {
    en: "Original Document",
    es: "Documento original",
    "zh-Hans": "原始文件",
    "zh-Hant": "原始文件",
    yue: "原始文件",
    ko: "원본 문서",
    vi: "Tài liệu gốc",
    tl: "Orihinal na Dokumento",
    ar: "المستند الأصلي",
    hi: "मूल दस्तावेज़",
    fr: "Document original",
    pt: "Documento original",
  },
  "confidence.high": {
    en: "High match",
    es: "Coincidencia alta",
    "zh-Hans": "高度匹配",
    "zh-Hant": "高度匹配",
    yue: "高度匹配",
    ko: "높은 일치",
    vi: "Khớp cao",
    tl: "Mataas na tugma",
    ar: "تطابق عالٍ",
    hi: "उच्च मिलान",
    fr: "Correspondance élevée",
    pt: "Alta correspondência",
  },
  "confidence.medium": {
    en: "Medium match",
    es: "Coincidencia media",
    "zh-Hans": "中度匹配",
    "zh-Hant": "中度匹配",
    yue: "中度匹配",
    ko: "중간 일치",
    vi: "Khớp trung bình",
    tl: "Katamtamang tugma",
    ar: "تطابق متوسط",
    hi: "मध्यम मिलान",
    fr: "Correspondance moyenne",
    pt: "Média correspondência",
  },
  "confidence.low": {
    en: "Low match",
    es: "Coincidencia baja",
    "zh-Hans": "低度匹配",
    "zh-Hant": "低度匹配",
    yue: "低度匹配",
    ko: "낮은 일치",
    vi: "Khớp thấp",
    tl: "Mababang tugma",
    ar: "تطابق منخفض",
    hi: "निम्न मिलान",
    fr: "Correspondance faible",
    pt: "Baixa correspondência",
  },
  "language_banner.prompt": {
    en: "What language do you prefer for field guidance?",
    es: "¿En qué idioma prefiere ver las explicaciones?",
    "zh-Hans": "您希望以哪种语言查看字段说明？",
    "zh-Hant": "您希望以哪種語言查看欄位說明？",
    yue: "您想用哪種語言睇欄位說明？",
    ko: "어떤 언어로 안내를 받으시겠습니까?",
    vi: "Bạn muốn xem hướng dẫn bằng ngôn ngữ nào?",
    tl: "Anong wika ang gusto mong gamitin para sa gabay?",
    ar: "ما اللغة التي تفضلها لشرح الحقول؟",
    hi: "आप किस भाषा में मार्गदर्शन पसंद करते हैं?",
    fr: "Dans quelle langue souhaitez-vous voir les explications ?",
    pt: "Em que idioma prefere ver as explicações?",
  },
};

/**
 * Get a translated UI string for the given language and key.
 * Falls back to English if the language or key is not found.
 */
export function getUIString(
  language: string | null | undefined,
  key: string
): string {
  const strings = UI_STRINGS[key];
  if (!strings) return key;
  const lang = language ?? "en";
  return strings[lang] ?? strings["en"] ?? key;
}

/**
 * Alias for getUIString with argument order matching common i18n conventions.
 * @example t("confidence.high", "es") // → "Coincidencia alta"
 */
export function t(key: string, lang?: string | null): string {
  return getUIString(lang, key);
}
