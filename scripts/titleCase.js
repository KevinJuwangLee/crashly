/**
 * Reads assets/universities.json, title-cases name, city, and state,
 * and writes the file back. Small words (of, and, the, at, in, for) stay
 * lowercase except when they're the first word. Two-letter state codes
 * stay fully uppercase.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'assets', 'universities.json');

const SMALL_WORDS = new Set(['of', 'and', 'the', 'at', 'in', 'for']);

/** Title-case segments separated by hyphens (e.g. co-op → Co-Op). */
function titleCaseHyphenated(token) {
  const lower = token.toLowerCase();
  return lower
    .split('-')
    .map((seg) => {
      if (seg.length === 0) return seg;
      return seg[0].toUpperCase() + seg.slice(1);
    })
    .join('-');
}

function titleCasePhrase(str) {
  if (str == null || typeof str !== 'string') return str;
  const trimmed = str.trim();
  if (trimmed === '') return str;

  const words = trimmed.split(/\s+/);
  return words
    .map((word, i) => {
      const lw = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lw)) {
        return lw;
      }
      return titleCaseHyphenated(word);
    })
    .join(' ');
}

function titleCaseState(str) {
  if (str == null || typeof str !== 'string') return str;
  const t = str.trim();
  if (t.length === 2 && /^[A-Za-z]{2}$/.test(t)) {
    return t.toUpperCase();
  }
  return titleCasePhrase(t);
}

function main() {
  const raw = fs.readFileSync(TARGET, 'utf8');
  /** @type {{ name: string; city: string; state: string }[]} */
  const rows = JSON.parse(raw);

  for (const row of rows) {
    row.name = titleCasePhrase(row.name);
    row.city = titleCasePhrase(row.city);
    row.state = titleCaseState(row.state);
  }

  fs.writeFileSync(TARGET, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  console.log(`Title-cased ${rows.length} rows → ${path.relative(ROOT, TARGET)}`);
}

main();
