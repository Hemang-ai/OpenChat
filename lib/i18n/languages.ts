/**
 * Language catalog for bot configuration and the visitor widget.
 *
 * Labels are native-script names first ("Español", "日本語") with the English
 * name as secondary context. No flags — flags encode countries, not languages.
 * `popular` pins the most widely used business-chat languages above the
 * searchable full list. Codes match what `Bot.defaultLocale` /
 * `Bot.supportedLocales` / `KnowledgeSource.locale` already store.
 */

export interface Language {
  code: string; // BCP-47
  nativeName: string;
  englishName: string;
  popular?: boolean;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: "en", nativeName: "English", englishName: "English", popular: true },
  { code: "es", nativeName: "Español", englishName: "Spanish", popular: true },
  { code: "fr", nativeName: "Français", englishName: "French", popular: true },
  { code: "de", nativeName: "Deutsch", englishName: "German", popular: true },
  { code: "pt", nativeName: "Português", englishName: "Portuguese", popular: true },
  { code: "it", nativeName: "Italiano", englishName: "Italian", popular: true },
  { code: "nl", nativeName: "Nederlands", englishName: "Dutch", popular: true },
  { code: "zh", nativeName: "中文（简体）", englishName: "Chinese (Simplified)", popular: true },
  { code: "ja", nativeName: "日本語", englishName: "Japanese", popular: true },
  { code: "ko", nativeName: "한국어", englishName: "Korean", popular: true },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", popular: true },
  { code: "ar", nativeName: "العربية", englishName: "Arabic", popular: true, rtl: true },
  { code: "bn", nativeName: "বাংলা", englishName: "Bengali" },
  { code: "cs", nativeName: "Čeština", englishName: "Czech" },
  { code: "da", nativeName: "Dansk", englishName: "Danish" },
  { code: "el", nativeName: "Ελληνικά", englishName: "Greek" },
  { code: "fi", nativeName: "Suomi", englishName: "Finnish" },
  { code: "he", nativeName: "עברית", englishName: "Hebrew", rtl: true },
  { code: "hu", nativeName: "Magyar", englishName: "Hungarian" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
  { code: "ms", nativeName: "Bahasa Melayu", englishName: "Malay" },
  { code: "no", nativeName: "Norsk", englishName: "Norwegian" },
  { code: "pl", nativeName: "Polski", englishName: "Polish" },
  { code: "ro", nativeName: "Română", englishName: "Romanian" },
  { code: "ru", nativeName: "Русский", englishName: "Russian" },
  { code: "sv", nativeName: "Svenska", englishName: "Swedish" },
  { code: "th", nativeName: "ไทย", englishName: "Thai" },
  { code: "tr", nativeName: "Türkçe", englishName: "Turkish" },
  { code: "uk", nativeName: "Українська", englishName: "Ukrainian" },
  { code: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
];

/**
 * Shared option list for every language picker in the dashboard (bot
 * settings, ecosystem tab, etc.) so they render identically instead of one
 * of them falling back to a raw comma-separated code field.
 */
export interface LanguagePickerOption {
  value: string;
  label: string;
  description: string;
  keywords: string[];
  group: string;
}

export function getLanguagePickerOptions(): LanguagePickerOption[] {
  return [...LANGUAGES.filter((l) => l.popular), ...LANGUAGES.filter((l) => !l.popular)].map((l) => ({
    value: l.code,
    label: l.nativeName,
    description: l.nativeName === l.englishName ? l.code : `${l.englishName} · ${l.code}`,
    keywords: [l.englishName, l.code],
    group: l.popular ? "Most common" : "All languages",
  }));
}

/** Native-name list for a "declare supported languages" message, e.g. in the widget header. */
export function describeLanguages(codes: string[]): string {
  return codes.map((code) => getLanguage(code)?.nativeName || code).join(", ");
}

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: string): Language | undefined {
  if (BY_CODE.has(code)) return BY_CODE.get(code);
  const base = code.split("-")[0];
  return BY_CODE.get(base);
}

export function isSupportedLanguage(code: string): boolean {
  return getLanguage(code) !== undefined;
}

/** Normalize an arbitrary browser locale ("es-MX", "pt_BR") to a catalog code. */
export function normalizeLanguage(locale: string | null | undefined): string | undefined {
  if (!locale) return undefined;
  const cleaned = locale.trim().replace("_", "-");
  const exact = BY_CODE.get(cleaned);
  if (exact) return exact.code;
  const base = BY_CODE.get(cleaned.split("-")[0]);
  return base?.code;
}

/** Pick the best language for a visitor: their preference if the bot supports it, else the default. */
export function resolveVisitorLanguage(
  requested: string | null | undefined,
  supportedLocales: string[],
  defaultLocale: string
): string {
  const normalized = normalizeLanguage(requested);
  if (normalized && supportedLocales.includes(normalized)) return normalized;
  return defaultLocale;
}

/**
 * Detect a message language only when there is a strong signal. Script-based
 * detection is deterministic; Latin-script languages use a small set of
 * common words so short, ambiguous product names do not switch the chat.
 */
export function detectMessageLanguage(
  message: string,
  supportedLocales: string[]
): string | undefined {
  const supported = new Set(
    supportedLocales.map((locale) => normalizeLanguage(locale)).filter(Boolean)
  );
  const canUse = (locale: string) => supported.has(locale);

  const scriptSignals: Array<[string, RegExp]> = [
    ["hi", /[\u0900-\u097f]/u],
    ["bn", /[\u0980-\u09ff]/u],
    ["ar", /[\u0600-\u06ff]/u],
    ["he", /[\u0590-\u05ff]/u],
    ["ja", /[\u3040-\u30ff]/u],
    ["ko", /[\uac00-\ud7af]/u],
    ["zh", /[\u3400-\u9fff]/u],
    ["el", /[\u0370-\u03ff]/u],
    ["th", /[\u0e00-\u0e7f]/u],
  ];

  for (const [locale, pattern] of scriptSignals) {
    if (canUse(locale) && pattern.test(message)) return locale;
  }

  if (/[\u0400-\u04ff]/u.test(message)) {
    if (canUse("uk") && /[іїєґ]/iu.test(message)) return "uk";
    if (canUse("ru")) return "ru";
  }

  const words = message
    .toLocaleLowerCase()
    .match(/[\p{L}\p{M}]+/gu) || [];
  if (words.length === 0) return undefined;

  const vocabularies: Record<string, Set<string>> = {
    en: new Set(["the", "is", "are", "what", "how", "can", "you", "your", "where", "when", "please", "help", "with", "about"]),
    es: new Set(["el", "la", "los", "las", "qué", "como", "cómo", "cuál", "dónde", "cuando", "puede", "puedo", "para", "con", "gracias", "hola"]),
    hi: new Set(["kya", "kaise", "hai", "hain", "mujhe", "aap", "kripya", "batao", "bataiye"]),
  };

  let best: { locale: string; score: number } | undefined;
  for (const [locale, vocabulary] of Object.entries(vocabularies)) {
    if (!canUse(locale)) continue;
    const score = words.reduce((total, word) => total + (vocabulary.has(word) ? 1 : 0), 0);
    if (!best || score > best.score) best = { locale, score };
  }

  return best && best.score >= 2 ? best.locale : undefined;
}

/**
 * Resolve the answer language for this turn. A clearly identifiable language
 * in the latest customer message wins, then the widget selection, then the
 * bot default. This lets a Hindi question receive a Hindi answer even when a
 * prior turn or the initial widget state was English.
 */
export function resolveResponseLanguage(
  message: string,
  requestedLocale: string | null | undefined,
  supportedLocales: string[],
  defaultLocale: string
): string {
  const detected = detectMessageLanguage(message, supportedLocales);
  if (detected) return detected;
  return resolveVisitorLanguage(requestedLocale, supportedLocales, defaultLocale);
}

const EXPECTED_SCRIPT: Record<string, RegExp> = {
  hi: /[\u0900-\u097f]/u,
  bn: /[\u0980-\u09ff]/u,
  ar: /[\u0600-\u06ff]/u,
  he: /[\u0590-\u05ff]/u,
  ja: /[\u3040-\u30ff\u3400-\u9fff]/u,
  ko: /[\uac00-\ud7af]/u,
  zh: /[\u3400-\u9fff]/u,
  el: /[\u0370-\u03ff]/u,
  ru: /[\u0400-\u04ff]/u,
  uk: /[\u0400-\u04ff]/u,
  th: /[\u0e00-\u0e7f]/u,
};

/** Latin-script locales cannot be validated reliably without another model. */
export function responseUsesExpectedScript(text: string, locale: string): boolean {
  const normalized = normalizeLanguage(locale) || locale;
  const expected = EXPECTED_SCRIPT[normalized];
  return expected ? expected.test(text) : true;
}
