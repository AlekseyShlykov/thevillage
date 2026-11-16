/** Original vector artwork. Re-run with `node scripts/draw-ui-icons.mjs`.
 * All icons share the village's ochre timber, sage, parchment and aged iron. */
import fs from 'node:fs/promises';
const out = new URL('../public/assets/ui/icons/', import.meta.url);
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (d, color = '#e5c995', width = 1.3, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const ellipse = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const wood = 'url(#wood)', iron = 'url(#iron)', paper = 'url(#paper)', gold = 'url(#gold)', leaf = 'url(#leaf)';
const log = (x, y) => `<g transform="translate(${x} ${y})">${path('M3 4 20 0Q25 0 25 7L9 14Z', wood)}${line('M8 5 19 2M11 9 23 5', '#644d35', 1)}${ellipse(6, 9, 5.5, 6.5, paper)}${ellipse(6, 9, 2.5, 3.5, 'none', 'stroke="#aa7c48" stroke-width="1"')}${line('M6 7 7 10', '#aa7c48', 1)}</g>`;
const axe = `<g transform="rotate(35 24 24)">${path('M22 9Q24 7 26 10L27 40Q25 44 22 40Z', wood)}${line('M24 19 24 37', '#edcc90', 1)}${path('M12 8Q20 13 34 7L35 19Q21 16 12 20Z', iron)}${line('M13 9 13 18M17 11 27 11', '#e5e4cb', 1.4)}${path('M23 9 27 9 27 19 23 18Z', '#887451')}</g>`;
const hammer = `<g transform="rotate(35 24 24)">${path('M22 14 27 14 26 41Q24 44 22 41Z', wood)}${line('M24 23 24 38', '#e9c58d', 1)}${path('M10 8 34 8 37 11 35 18 11 18 9 15Z', iron)}${path('M10 8 14 8 14 18 11 18 9 15Z', '#d2d4be')}${line('M16 10 32 10', '#e9e7d0')}</g>`;
const bow = `${path('M14 5Q42 22 15 43L12 39Q33 24 12 9Z', wood)}${line('M15 8 20 24 15 40', '#f0dfb4', 1.1)}${line('M5 29 39 16', '#e2bf82', 2)}${path('M35 13 44 14 38 21Z', iron)}${line('M7 30 6 24M10 29 9 23', '#c1a170', 2)}`;
const wheat = `${line('M22 42 25 10M22 40 12 24M23 39 37 23', '#b99b5f', 2.4)}${path('M25 17Q17 15 19 10Q25 10 25 17ZM25 24Q16 22 18 17Q24 17 25 24ZM24 31Q15 29 17 24Q24 24 24 31ZM26 16Q33 12 31 7Q26 9 26 16ZM25 23Q34 20 32 15Q26 16 25 23ZM24 30Q33 28 32 23Q26 23 24 30Z', gold)}${path('M14 28Q7 27 8 21Q14 22 14 28ZM17 33Q9 34 9 28Q15 28 17 33ZM33 29Q41 27 40 21Q34 22 33 29ZM29 34Q38 33 38 28Q31 28 29 34Z', leaf)}`;
const hut = `${path('M8 22 25 14 40 23 39 39 24 44 9 37Z', wood)}${path('M24 25 40 23 39 39 24 44Z', '#8e6845')}${line('M11 30 23 35M11 35 23 40M27 30 37 27M27 35 37 32', '#715439', 1)}${path('M4 23 23 5 44 22 26 30Z', gold)}${path('M23 5 26 30 44 22Z', '#ab8950')}${line('M8 22 23 9M12 24 24 13M28 15 39 22', '#f0d394', 1)}${path('M28 32 35 30 35 40 28 42Z', '#4a4832')}${path('M13 27 19 30 19 35 13 32Z', '#f3cd75')}${path('M32 7 37 9 37 17 32 15Z', '#8b8e79')}`;
const bell = `${path('M15 31Q17 27 16 19Q16 10 25 10Q34 10 34 19Q33 27 37 31L38 34Q25 39 12 34Z', gold)}${path('M21 36Q21 42 26 42Q30 42 31 36Z', '#b38c51')}${path('M22 11 22 7Q25 3 28 7L28 11Z', '#c6ad78')}${line('M21 16Q18 21 20 28', '#f7e5b0', 2)}`;
const chest = `${path('M7 24 38 21 41 37 12 43 6 36Z', wood)}${path('M12 30 41 25 41 37 12 43Z', '#9a7249')}${path('M6 24Q5 19 11 17L34 14Q39 15 39 21L12 29Z', gold)}${line('M11 20 33 17M16 32 37 28', '#e7c18a', 1)}${path('M13 28 17 27 19 41 15 42Z', iron)}${path('M32 24 36 23 38 38 34 39Z', iron)}${path('M23 29 28 28 29 34 24 35Z', '#d6bd7d')}`;
const arrow = (direction = 'down') => `<g ${direction === 'up' ? 'transform="rotate(180 25 14)"' : ''}>${path('M21 3 29 3 29 14 35 14 25 24 15 14 21 14Z', paper)}${line('M23 5 23 15 20 15', '#fff0c7', 1)}</g>`;
const person = (x, y, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})">${path('M-10 16Q-12 4 0 3Q12 4 10 16Z', leaf)}${ellipse(0, -1, 6, 7, paper)}${path('M-6 0Q-10-10 0-11Q9-10 6 0L3-5-3-4Z', wood)}${line('M-5 7 0 12 5 7', '#c0b57d', 1)}</g>`;
const boot = `${path('M15 5 29 6 27 23Q31 29 39 31L40 36Q31 43 12 37L10 31 14 24Z', wood)}${path('M12 35Q26 40 40 34L40 39Q25 46 11 40Z', '#494c35')}${path('M15 5 29 6 28 13 14 12Z', paper)}${line('M16 17 25 18M15 21 24 22M18 27 25 29', '#e3bf85', 1.5)}`;
const gate = (open) => `${path('M5 11 9 6 13 11 13 42 5 42ZM35 11 39 6 43 11 43 42 35 42Z', wood)}${path(open ? 'M14 17 25 12 25 35 14 40Z' : 'M14 16 34 16 34 39 14 39Z', wood)}${line(open ? 'M17 18 22 16M17 33 22 31' : 'M17 19 17 36M23 19 23 36M29 19 29 36M15 23 33 23M15 33 33 33', '#e2bc7b', 1.5)}${path('M6 20 12 20 12 24 6 24ZM36 20 42 20 42 24 36 24Z', iron)}`;

const icons = {
  clothing: `${path('M16 7 22 5 26 5 32 7 42 18 35 24 32 20 33 42 15 42 16 20 12 25 5 19Z', wood)}${path('M19 6 24 14 29 6 33 10 28 18 28 41 20 41 20 18 15 10Z', paper)}${line('M24 16 24 40M17 30 20 30M28 30 31 30', '#6f583e', 1.5)}${ellipse(24,23,1.2,1.2,iron)}${ellipse(24,30,1.2,1.2,iron)}`,
  wood: log(4, 12) + log(17, 22) + log(3, 28),
  food: `${path('M29 28 39 35 36 39 26 32Z', paper)}${ellipse(39, 36, 4, 4, paper)}${ellipse(35, 40, 4, 4, paper)}${path('M8 10Q17 2 28 10Q36 17 31 28Q22 39 9 30Q0 23 8 10Z', 'url(#red)')}${path('M11 12Q17 8 23 12Q28 16 24 22Q18 28 11 23Q7 19 11 12Z', '#d6a375')}${line('M9 14Q5 22 12 27M17 10 22 12', '#edc08a', 1.5)}${line('M28 28 31 31', '#7d4b35', 2)}`,
  fur: `${path('M13 6 21 10 27 10 35 6 38 13 34 19 40 35 33 34 35 42 26 39 24 44 20 39 12 42 14 34 7 35 14 19 10 13Z', paper)}${path('M18 11Q24 17 30 11L33 17 28 34 24 38 20 34 15 17Z', '#baa477')}${line('M15 22 12 29M19 26 17 34M32 23 35 30M27 26 29 34', '#eee0b6', 1.4)}`,
  tools: `<g transform="translate(-4 1) scale(.9)">${axe}</g><g transform="translate(42 4) scale(-.85 .85)">${hammer}</g>`,
  villagers: person(32, 24, .8) + person(17, 24, 1.05),
  comfort: `${path('M8 37 8 22Q8 6 24 6Q40 6 40 22L40 37Z', '#8c8d70')}${path('M14 37 14 23Q14 13 24 13Q34 13 34 23L34 37Z', '#394839')}${line('M11 21 15 21M34 21 38 21M24 8 24 12', '#babb94', 1.4)}${path('M17 36Q13 29 22 21L24 15Q35 26 29 36Z', 'url(#red)')}${path('M21 36Q18 31 25 25Q31 33 26 36Z', gold)}${path('M5 37 43 37 43 42 5 42Z', wood)}`,
  research: `${path('M11 7Q24 3 36 8L35 36Q25 40 12 36Z', paper)}${path('M10 7Q4 8 7 14L13 14 12 9 36 9Q34 5 31 5Z', gold)}${path('M12 33 35 33Q43 33 40 40L14 41Q9 39 12 33Z', gold)}${path('M24 13 26 19 32 20 27 24 28 30 23 27 18 30 19 24 15 20 21 19Z', '#a78449')}${line('M16 10 29 10M17 36 35 36', '#f1dfae', 1)}`,
  book: `${path('M4 12Q13 7 24 13Q35 7 44 12L43 38Q34 34 24 41Q15 34 5 38Z', '#74543a')}${path('M6 9Q15 6 24 12Q33 6 42 9L41 34Q32 32 24 38Q16 32 7 34Z', paper)}${line('M24 12 24 36', '#997b4e', 1.5)}${line('M10 15 18 17M10 20 19 22M11 25 18 27M29 17 37 15M29 22 37 20M29 27 36 25', '#b79b65', 1.4)}${path('M31 8 35 7 35 19 33 17 31 20Z', '#a45d42')}`,
  save: chest + arrow(),
  load: chest + arrow('up'),
  sound: bell + line('M38 10Q44 18 41 24M9 12Q5 19 8 25', '#d9c18c', 1.8),
  muted: bell + line('M8 8 40 41', '#3b4030', 5) + line('M8 8 40 41', '#bb8964', 2.5),
  pause: `${path('M10 9 20 7 20 40 10 41Z', wood)}${path('M28 8 38 7 38 40 28 41Z', wood)}${line('M13 12 13 36M31 12 31 36', '#e8c488', 2)}`,
  axe, bow, wheat, hammer, home: hut,
  build: `${path('M6 29 19 17 32 28 31 41 8 41Z', wood)}${line('M11 31 27 31M14 35 14 40M25 35 25 40', '#e9c68a', 1.2)}<g transform="translate(17 -2) scale(.7)">${hammer}</g>`,
  repair: `${path('M28 6Q36 3 41 10L34 11 32 17 38 21Q32 26 27 23L14 40Q9 44 6 39Q4 36 8 33L23 19Q19 11 28 6Z', iron)}${line('M9 36 25 19M27 10 25 15', '#e6e5cb', 1.5)}${ellipse(10, 37, 2, 2, '#596953')}`,
  work: `${path('M5 13 19 13 21 10 40 10 41 18 33 24 21 24 18 17 8 17Z', iron)}${path('M21 24 31 24 29 34 36 38 35 41 15 41 14 38 22 33Z', iron)}${line('M22 13 37 13M22 36 30 36', '#e3e4c9', 1.4)}${path('M7 42 40 42 40 45 7 45Z', wood)}`,
  move: boot,
  resume: `<g transform="translate(-3 8) scale(.8)">${boot}</g>${path('M29 6 37 6 37 2 45 11 37 20 37 15 29 15Z', gold)}`,
  stop: `${path('M16 5 33 5 43 15 43 32 33 43 16 43 5 32 5 15Z', wood)}${path('M17 10 31 10 38 17 38 30 31 37 17 37 10 30 10 17Z', '#8d5d44')}${path('M18 16 30 16 30 31 18 31Z', paper)}${line('M8 16 17 7 31 7', '#dbba81', 1.4)}`,
  restart: `${path('M12 16Q17 5 29 8Q42 10 41 25Q40 39 26 41Q15 42 9 33L15 29Q19 36 27 34Q35 32 34 24Q33 14 24 14Q19 14 17 18L23 21 6 25 6 9Z', gold)}${line('M19 10Q35 6 39 20', '#f4dfac', 1.4)}`,
  release: `${path('M8 24 19 12 19 20 32 20Q39 20 40 30L33 31Q33 27 29 27L19 27 19 35Z', gold)}${line('M11 24 16 18M22 23 30 23', '#f1dba6', 1.2)}`,
  gateOpen: gate(true), gateClosed: gate(false),
  demolish: `${path('M9 33 23 14 27 17 14 40 8 41Z', wood)}${path('M6 14 9 10 39 32 36 37Z', wood)}${line('M10 15 33 33M13 34 22 21', '#e4be7f', 1.5)}${path('M29 5 41 7 37 20 25 18Z', iron)}${line('M29 8 37 9', '#e3e5ca', 1.5)}`,
  warning: `${path('M22 6Q24 2 27 6L44 37Q46 41 41 42L7 42Q2 42 5 37Z', gold)}${path('M22 15 27 15 26 30 23 30Z', '#594a32')}${ellipse(24.5, 35, 2, 2, '#594a32')}${line('M9 35 22 10', '#f4dfaa', 1.5)}`,
  ward: `${path('M7 25Q24 35 41 25L37 38Q24 47 11 38Z', iron)}${path('M14 28Q9 18 18 15L24 5 29 15Q39 20 32 29Z', leaf)}${path('M20 28Q16 22 24 15Q31 24 27 29Z', gold)}${line('M6 18Q3 9 12 5M36 5Q45 9 42 18', '#c7ce98', 1.6)}`,
  herbs: `${line('M21 43 23 11M25 42 35 14M20 40 11 18', '#ab9362', 2)}${path('M22 19Q8 14 13 7Q24 6 22 19ZM23 26Q33 10 38 19Q35 29 23 26ZM19 29Q5 26 8 18Q18 16 19 29ZM27 32Q39 20 42 28Q38 36 27 32Z', leaf)}${path('M15 34 29 33 31 39 16 41Z', paper)}${line('M17 36 28 35M18 39 29 38', '#8c714a', 1)}`,
  check: line('M8 25 19 36 40 12', '#435840', 7) + line('M8 23 19 34 40 10', '#c6d09a', 4),
  close: line('M13 12 36 35M35 12 12 35', '#4e4832', 7) + line('M13 11 36 34M35 11 12 34', '#dac08a', 4),
  plus: line('M24 10 24 38M10 24 38 24', '#554b32', 7) + line('M24 9 24 37M10 23 38 23', '#dac08a', 4),
  minus: line('M11 25 37 25', '#554b32', 7) + line('M11 23 37 23', '#dac08a', 4),
};

const defs = `<defs>
<linearGradient id="wood" x2=".3" y2="1"><stop stop-color="#d5ad71"/><stop offset=".48" stop-color="#b58b55"/><stop offset="1" stop-color="#79583b"/></linearGradient>
<linearGradient id="iron" x2=".4" y2="1"><stop stop-color="#d6d8c0"/><stop offset=".45" stop-color="#a4afa0"/><stop offset="1" stop-color="#667a70"/></linearGradient>
<linearGradient id="paper" x2=".3" y2="1"><stop stop-color="#f1dfb0"/><stop offset="1" stop-color="#c0a272"/></linearGradient>
<linearGradient id="gold" x2=".3" y2="1"><stop stop-color="#efd399"/><stop offset=".5" stop-color="#c5a36a"/><stop offset="1" stop-color="#967343"/></linearGradient>
<linearGradient id="leaf" x2=".2" y2="1"><stop stop-color="#a6b27a"/><stop offset="1" stop-color="#526f4e"/></linearGradient>
<linearGradient id="red" x2=".3" y2="1"><stop stop-color="#d9a06c"/><stop offset=".5" stop-color="#b5714f"/><stop offset="1" stop-color="#824a36"/></linearGradient>
<filter id="shadow" x="-.2" y="-.2" width="1.4" height="1.4"><feDropShadow dx="0" dy="1" stdDeviation=".5" flood-color="#10241b" flood-opacity=".5"/></filter>
</defs>`;
await fs.mkdir(out, { recursive: true });
for (const [name, art] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">${defs}<g stroke="#414431" stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round" filter="url(#shadow)">${art}</g></svg>\n`;
  await fs.writeFile(new URL(`${name}.svg`, out), svg);
}
console.log(`Drew ${Object.keys(icons).length} interface icons.`);
