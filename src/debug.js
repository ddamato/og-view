import { RULES } from './rules/index.js';
import { resolvePlatforms } from './resolve.js';
import { SOURCES, PLATFORMS, debuggers } from './sources.js';

const ORDER = { error: 0, warning: 1, info: 2 };

/**
 * @typedef {object} Report
 * @property {Record<string, import('./collect.js').Field>} fields
 * @property {import('./rules/util.js').Finding[]} findings
 */

/**
 * Runs every rule against collected metadata.
 * @param {import('./collect.js').Collected} c
 * @param {import('./rules/util.js').Context['measure']} [measure]
 * @returns {Report}
 */
export function analyze(c, measure = () => undefined) {
  /** @type {import('./rules/util.js').Context} */
  const ctx = { c, p: resolvePlatforms(c), measure };
  /** @type {import('./rules/util.js').Finding[]} */
  const findings = [];
  for (const r of RULES) {
    let result;
    try {
      result = r.check(ctx);
    } catch (error) {
      console.error(`og-view: rule "${r.id}" threw`, error);
      continue;
    }
    for (const partial of [result ?? []].flat()) {
      if (!partial) continue;
      findings.push({ id: r.id, platforms: r.platforms, sources: r.sources, ...partial });
    }
  }
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return { fields: c.fields, findings };
}

/**
 * Prints a report as a single collapsed console group.
 * @param {Report} report
 * @param {string} pageUrl The URL to pass to platform debuggers.
 */
export function log({ fields, findings }, pageUrl) {
  const count = (/** @type {string} */ severity) => findings.filter((f) => f.severity === severity).length;
  const summary = [
    [count('error'), 'error'],
    [count('warning'), 'warning'],
    [count('info'), 'info'],
  ]
    .filter(([n]) => n)
    .map(([n, label]) => `${n} ${label}${n !== 1 && label !== 'info' ? 's' : ''}`)
    .join(', ');

  console.groupCollapsed(`%cog-view%c · ${summary || 'no issues'}`, 'font-weight: bold', 'font-weight: normal');

  console.table(
    Object.fromEntries(
      Object.entries(fields)
        .filter(([, field]) => field.value)
        .map(([name, field]) => [name, { value: field.value, source: field.source }]),
    ),
  );

  for (const finding of findings) {
    const platforms = finding.platforms.map((p) => PLATFORMS[/** @type {keyof typeof PLATFORMS} */ (p)] ?? p).join(', ');
    const sources = finding.sources.map((key) => SOURCES[key]?.url).filter(Boolean);
    const lines = [`[${platforms}] ${finding.message}`];
    if (finding.fix) lines.push(`→ ${finding.fix}`);
    if (sources.length) lines.push(`Source: ${sources.join(' · ')}`);
    const method = finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warn' : 'info';
    console[method](lines.join('\n'));
  }

  console.groupCollapsed('Platform debuggers');
  for (const { name, url, note } of debuggers(pageUrl)) console.log(`${name}: ${url}\n${note}`);
  console.groupEnd();

  console.groupEnd();
}
