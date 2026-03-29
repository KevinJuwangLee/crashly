/**
 * Reads assets/universities.csv (semicolon-delimited, quoted fields),
 * extracts NAME, CITY, STATE, filters invalid rows, dedupes by name,
 * writes assets/universities.json.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'universities.csv');
const OUTPUT = path.join(ROOT, 'assets', 'universities.json');

const NA = 'NOT AVAILABLE';

/** Parse one semicolon-separated line; respects "..." with "" as escape. */
function parseSemicolonLine(line) {
  const fields = [];
  let i = 0;
  let cur = '';
  while (i < line.length) {
    const c = line[i];
    if (c === '"') {
      i += 1;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          cur += '"';
          i += 2;
        } else if (line[i] === '"') {
          i += 1;
          break;
        } else {
          cur += line[i];
          i += 1;
        }
      }
    } else if (c === ';') {
      fields.push(cur);
      cur = '';
      i += 1;
    } else {
      cur += c;
      i += 1;
    }
  }
  fields.push(cur);
  return fields;
}

function isValidCell(value) {
  const t = value.trim();
  if (t === '') return false;
  if (t.toUpperCase() === NA) return false;
  return true;
}

function main() {
  const raw = fs.readFileSync(INPUT, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.error('Expected header + data rows');
    process.exit(1);
  }

  const headerFields = parseSemicolonLine(lines[0]);
  const nameIdx = headerFields.indexOf('NAME');
  const cityIdx = headerFields.indexOf('CITY');
  const stateIdx = headerFields.indexOf('STATE');

  if (nameIdx === -1 || cityIdx === -1 || stateIdx === -1) {
    console.error('Missing NAME, CITY, or STATE in header:', headerFields);
    process.exit(1);
  }

  /** @type {Map<string, { name: string, city: string, state: string }>} */
  const byNameKey = new Map();

  for (let r = 1; r < lines.length; r++) {
    const cols = parseSemicolonLine(lines[r]);
    const name = cols[nameIdx] ?? '';
    const city = cols[cityIdx] ?? '';
    const state = cols[stateIdx] ?? '';

    if (!isValidCell(name) || !isValidCell(city) || !isValidCell(state)) {
      continue;
    }

    const nameTrim = name.trim();
    const cityTrim = city.trim();
    const stateTrim = state.trim();
    const dedupeKey = nameTrim.toUpperCase();

    if (!byNameKey.has(dedupeKey)) {
      byNameKey.set(dedupeKey, {
        name: nameTrim,
        city: cityTrim,
        state: stateTrim,
      });
    }
  }

  const out = [...byNameKey.values()];
  fs.writeFileSync(OUTPUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote ${out.length} universities to ${path.relative(ROOT, OUTPUT)}`,
  );
}

main();
