import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = './articles';

function parseFrontMatterToJson(content) {
  if (!content.startsWith('---\n')) {
    return null;
  }
  const parts = content.split('---\n');
  if (parts.length <= 2) {
    return null;
  }

  const yamlPart = parts[1].trim();
  if (!yamlPart) {
      return null;
  }

  const jsonLines = yamlPart
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^(\s*)(\w+):(.*)/, (match, indent, key, value) => {
        let jsonValue = value.trim();
        if (!jsonValue.startsWith('"') && !jsonValue.startsWith('{') && !jsonValue.startsWith('[') && !['true', 'false', 'null'].includes(jsonValue) && isNaN(parseFloat(jsonValue))) {
            jsonValue = `"${jsonValue.replace(/"/g, '\\"')}"`;
        }
        if(jsonValue === '""' || jsonValue === '') {
            jsonValue = 'null';
        }
        return `${indent}"${key}":${jsonValue}`;
    }));

  const jsonBodyString = `{${jsonLines.join(',')}}`;

  try {
    return JSON.parse(jsonBodyString);
  } catch (e) {
    console.error(`[Error] Failed to parse front matter as JSON for a file. \nParser input: ${jsonBodyString}\nError: ${e.message}`);
    return null;
  }
}

try {
  const entries = fs.readdirSync(ARTICLES_DIR, { withFileTypes: true });

  let articles = [];

  for (const entry of entries) {
    if (entry.isDirectory() || !entry.name.endsWith('.md')) {
      continue;
    }

    const articlePath = path.join(ARTICLES_DIR, entry.name);
    let content = '';
    try {
      content = fs.readFileSync(articlePath, 'utf-8');
    } catch (readErr) {
      console.error(`[Error] Reading file ${articlePath}: ${readErr.message}`);
      continue;
    }

    const details = parseFrontMatterToJson(content);

    if (!details) {
      console.warn(`[Warn] Could not parse front matter for ${articlePath}`);
      continue;
    }

    if (details.published === false || details.published === 'false') {
      continue;
    }

    details.id = entry.name;

    articles.push(details);
  }

  articles.sort((a, b) => {
    const parseDate = (dateStr) => {
      if (typeof dateStr !== 'string') return null;
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        try {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const day = parseInt(parts[2]);
          if (year > 0 && month >= 0 && month <= 11 && day > 0 && day <= 31) {
              const date = new Date(Date.UTC(year, month, day));
              if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
                  return date;
              }
          }
        } catch (e) { }
      }
      return null;
    };

    const timeA = parseDate(a.created_at);
    const timeB = parseDate(b.created_at);

    if (timeA === null && timeB === null) {
      return a.title.localeCompare(b.title);
    }
    if (timeA === null) {
      return 1;
    }
    if (timeB === null) {
      return -1;
    }

    const timeDiff = timeA.getTime() - timeB.getTime();
    if (timeDiff === 0) {
      return a.title.localeCompare(b.title);
    }
    return timeDiff;
  });

  const outputJson = JSON.stringify(articles, null, "  ");

  try {
    fs.writeFileSync('articles.json', outputJson, 'utf-8');
    console.log('[Success] Successfully wrote articles.json');
  } catch (writeErr) {
    console.error(`[Error] Writing articles.json: ${writeErr.message}`);
  }

} catch (err) {
  console.error('[Fatal] An error occurred during script execution:', err.message);
}