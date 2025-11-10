/*
  Extract original sources from Next.js/Turbopack source maps.
  Outputs to recovered-src/<relative-path> preserving folders (e.g., src/app/**).
*/

const fs = require('fs');
const path = require('path');

const CWD = process.cwd();
const NEXT_DIR = path.join(CWD, '.next');
const OUTPUT_DIR = path.join(CWD, 'recovered-src');

function isMapFile(filePath) {
  return filePath.endsWith('.map');
}

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return files;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (isMapFile(full)) {
      files.push(full);
    }
  }
  return files;
}

function sanitizePath(p) {
  if (!p) return null;
  // Remove schemes and drive prefixes
  p = p.replace(/^file:\/\//, '');
  p = p.replace(/^webpack:\/\//, '');
  p = p.replace(/^turbopack:\/\//, '');
  p = p.replace(/^\w:\\/, ''); // Windows drive like D:\
  p = p.replace(/^\w:\//, ''); // Windows drive like D:/
  p = p.replace(/\\/g, '/');
  p = p.replace(/^\.\/?/, '');

  // Keep relative path starting at src/app, src/pages, app, or pages
  const candidates = ['/src/', '/app/', '/pages/'];
  for (const c of candidates) {
    const idx = p.indexOf(c);
    if (idx >= 0) {
      p = p.slice(idx + 1); // remove leading slash
      break;
    }
  }

  // Only accept project sources (skip turbopack internals, node_modules, etc.)
  const hasProjectSegment = /(^|\/)src\//.test(p) || /(^|\/)app\//.test(p) || /(^|\/)pages\//.test(p);
  if (/node_modules\//.test(p)) return null;
  if (!hasProjectSegment) return null;

  // If still absolute, drop to filename
  if (p.startsWith('/')) {
    p = p.slice(1);
  }

  // Only allow reasonable extensions
  if (!/\.(jsx?|tsx?|css|scss|less|json|svg)$/.test(p)) return null;

  return p;
}

function trimTrailingSeparators(p) {
  return p.replace(/[\\/]+$/, '');
}

function ensureDirFor(filePath) {
  const trimmed = trimTrailingSeparators(filePath);
  const parsed = path.parse(trimmed);
  const dir = parsed.dir || path.dirname(trimmed);
  fs.mkdirSync(dir, { recursive: true });
}

function writeIfBetter(targetPath, content) {
  try {
    if (fs.existsSync(targetPath)) {
      const existing = fs.readFileSync(targetPath, 'utf8');
      if ((content || '').length > existing.length) {
        fs.writeFileSync(targetPath, content);
      }
    } else {
      fs.writeFileSync(targetPath, content);
    }
  } catch (e) {
    // ignore write errors to keep going
  }
}

function processSectionMap(map) {
  const out = [];
  if (!map) return out;
  if (Array.isArray(map.sources) && Array.isArray(map.sourcesContent)) {
    const len = Math.min(map.sources.length, map.sourcesContent.length);
    for (let i = 0; i < len; i++) {
      out.push({ src: map.sources[i], content: map.sourcesContent[i] });
    }
  }
  return out;
}

function processMapFile(filePath) {
  let data;
  try {
    data = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { count: 0 };
  }
  let map;
  try {
    map = JSON.parse(data);
  } catch (e) {
    return { count: 0 };
  }

  let pairs = [];
  if (Array.isArray(map.sections) && map.sections.length) {
    for (const section of map.sections) {
      if (section && section.map) {
        pairs.push(...processSectionMap(section.map));
      }
    }
  } else {
    pairs.push(...processSectionMap(map));
  }

  let written = 0;
  for (const { src, content } of pairs) {
    if (!src || !content) continue;
    const sanitized = sanitizePath(src);
    if (!sanitized) continue;
    const target = path.join(OUTPUT_DIR, sanitized);
    ensureDirFor(target);
    writeIfBetter(target, content);
    written++;
  }

  return { count: written };
}

function main() {
  if (!fs.existsSync(NEXT_DIR)) {
    console.error('No .next directory found at', NEXT_DIR);
    process.exit(1);
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const mapFiles = walk(NEXT_DIR);
  let total = 0;
  for (const f of mapFiles) {
    const res = processMapFile(f);
    total += res.count;
  }
  console.log(`Processed ${mapFiles.length} map files. Wrote ${total} sources.`);
  console.log(`Recovered sources are under: ${OUTPUT_DIR}`);
}

main();