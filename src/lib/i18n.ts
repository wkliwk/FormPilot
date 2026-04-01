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
  return strings[lang] ?? strings.en ?? key;
}
