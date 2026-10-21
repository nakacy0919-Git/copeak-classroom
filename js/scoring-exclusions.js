/* Copeak Scoring Exclusions v1 — local only; no AI calls or network access.
   A phrase is excluded wherever its exact normalized comparison units occur.
   Display text, speech recognition, WPM and previously saved scores remain unchanged. */
(function (root) {
  'use strict';
  const MAX_PHRASES = 20;
  const MAX_CHARS = 60;
  const normalize = value => String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/gu, ' ');

  function parseList(raw) {
    const values = Array.isArray(raw) ? raw : String(raw == null ? '' : raw).split(/[\r\n;,、]+/u);
    const seen = new Set();
    const out = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const name = normalize(value);
      if (!name) continue;
      const key = name.toLocaleLowerCase('en');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }

  function validateList(raw) {
    const names = parseList(raw);
    if (names.length > MAX_PHRASES) throw new Error(`除外語句は最大${MAX_PHRASES}件です。`);
    if (names.some(name => name.length > MAX_CHARS)) {
      throw new Error(`除外語句は1件${MAX_CHARS}文字以内にしてください。`);
    }
    return names;
  }

  function safeList(raw) {
    try { return validateList(raw); } catch (_) { return []; }
  }

  function suggestNames(rawText) {
    const text = String(rawText == null ? '' : rawText);
    const found = [];
    const occupied = [];
    const patterns = [
      /\b(?:Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gu,
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/gu,
      /\b[A-Z]{2,}(?:[.-][A-Z]{2,})*\b/gu,
      /\b[A-Z][a-z]{2,}\b/gu
    ];
    const common = new Set(['The','This','That','There','These','Those','When','Where','Why','Who','What','How','After','Before','During','Once','However','Today','Tomorrow','Yesterday','My','Our','Their','His','Her','He','She','They','We','It','And','But','Because','If','In','On','At','A','An','English','American']);
    for (const p of patterns) {
      for (const match of text.matchAll(p)) {
        const candidate = normalize(match[0]);
        const start = match.index;
        const end = start + match[0].length;
        if (occupied.some(([a, b]) => start < b && end > a)) continue;
        if (candidate.length < 2 || candidate.length > MAX_CHARS) continue;
        if (common.has(candidate)) continue;
        // Avoid falsely suggesting the first word of a sentence as a name.
        if (p === patterns[3]) {
          const before = text.slice(0, match.index).trimEnd();
          if (!before || /[.!?。！？]\s*$/u.test(before)) continue;
        }
        if (!found.some(item => item.toLocaleLowerCase('en') === candidate.toLocaleLowerCase('en'))) {
          found.push(candidate);
          occupied.push([start, end]);
        }
        if (found.length >= MAX_PHRASES) return found;
      }
    }
    return found;
  }

  function selectScoredTokens(targetTokens, excludedPhrases, tokenizePhrase) {
    const tokens = Array.isArray(targetTokens) ? targetTokens : [];
    const names = safeList(excludedPhrases);
    if (!names.length || typeof tokenizePhrase !== 'function') {
      return { tokens: tokens.slice(), excludedIndexes: [], excludedCount: 0 };
    }
    const patterns = names.map(name => tokenizePhrase(name))
      .filter(items => Array.isArray(items) && items.length > 0 && items.every(Boolean))
      .sort((a, b) => b.length - a.length);
    const excluded = new Set();
    for (const pattern of patterns) {
      for (let i = 0; i <= tokens.length - pattern.length; i++) {
        if (pattern.every((part, j) => tokens[i + j] === part)) {
          for (let j = 0; j < pattern.length; j++) excluded.add(i + j);
        }
      }
    }
    const scored = tokens.filter((_, i) => !excluded.has(i));
    // Never silently issue a 0-word denominator for an invalid lesson.
    if (!scored.length) return { tokens: tokens.slice(), excludedIndexes: [], excludedCount: 0 };
    return { tokens: scored, excludedIndexes: [...excluded].sort((a,b) => a-b), excludedCount: excluded.size };
  }

  const api = Object.freeze({ parseList, validateList, safeList, suggestNames, selectScoredTokens,
    MAX_PHRASES, MAX_CHARS });
  root.CopeakScoreExclusions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
