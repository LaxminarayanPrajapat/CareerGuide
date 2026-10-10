import { readFileSync } from 'node:fs';

/**
 * Minimal `.env` reader used by the scripts in this folder, so they do not
 * need to pull in a dependency or import server TypeScript code.
 */
export default function readEnvFile(filePath) {
  const values = {};
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return values;
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    // Strip matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}
