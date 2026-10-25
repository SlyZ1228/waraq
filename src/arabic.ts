export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/ٱ/g, "ا")
    .trim();
}
export function lookupKeys(text: string): string[] {
  const key = normalize(text);
  return [...new Set([key, key.replace(/[أإآ]/g, "ا")])];
}
export function rootKey(text: string): string {
  return normalize(text).replace(/[ .·]/g, "");
}
export const arabicWord =
  /[\u0621-\u063a\u0641-\u064a\u0671][\u0621-\u063a\u0641-\u065f\u0670\u0671\u0640]*/g;
export function cleanWord(text: string): string {
  return text
    .trim()
    .replace(/^[^\u0621-\u064a\u0671]+|[^\u0621-\u065f\u0670\u0671]+$/g, "");
}
const labels: Record<string, Record<string, string>> = {
  pos: {
    noun: "Noun",
    verb: "Verb",
    adj: "Adjective",
    adv: "Adverb",
    prep: "Preposition",
    pron: "Pronoun",
    noun_prop: "Proper noun",
    conj: "Conjunction",
  },
  asp: { p: "Perfect", i: "Imperfect", c: "Imperative" },
  vox: { a: "Active", p: "Passive" },
  per: { "1": "1st person", "2": "2nd person", "3": "3rd person" },
  gen: { m: "Masculine", f: "Feminine" },
  num: { s: "Singular", d: "Dual", p: "Plural" },
  cas: {
    n: "Nominative",
    a: "Accusative",
    g: "Genitive",
    u: "Unspecified case",
  },
  mod: {
    i: "Indicative",
    s: "Subjunctive",
    j: "Jussive",
    u: "Unspecified mood",
  },
  stt: { d: "Definite", i: "Indefinite", c: "Construct state" },
};
export function featureLabel(key: string, value: string) {
  return labels[key]?.[value] || value.replaceAll("_", " · ");
}
export function patternLabel(pattern: string) {
  return pattern
    .replaceAll("1", "ف")
    .replaceAll("2", "ع")
    .replaceAll("3", "ل")
    .replaceAll("4", "ل");
}
export function verbForm(pattern: string) {
  const shape = pattern
    .replace(/ٱ/g, "ا")
    .replace(/[\u064b-\u0652]/g, (ch) => (ch === "ّ" ? ch : ""));
  const patterns: Record<string, string> = {
    "123": "I",
    "12ّ3": "II",
    "1ا23": "III",
    أ123: "IV",
    ت12ّ3: "V",
    ت1ا23: "VI",
    ان123: "VII",
    ا1ت23: "VIII",
    ا123ّ: "IX",
    است123: "X",
  };
  return patterns[shape] ? `Form ${patterns[shape]}` : undefined;
}
