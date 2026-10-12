import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gemini from './gemini.js';
import { flightsPrompt } from './gemini.js';

const chicago = {
  placeId: 'relation-1', name: 'Chicago', city: 'Chicago', country: 'United States',
  displayName: 'Chicago, Cook County, Illinois, United States', lat: 41.88, lon: -87.62,
};
const trip = { start: '', end: '', days: null, style: 'general' };

// Every prompt builder in gemini.js, called the way the app calls it.
const builders = {
  overviewPrompt: (f) => f(chicago, 'J:0°C/45mm F:2°C/40mm', trip),
  stayPrompt: (f) => f(chicago, 'The Palmer House; Freehand Chicago'),
  eatPrompt: (f) => f(chicago, "Lou Malnati's; Au Cheval"),
  seeDoPrompt: (f) => f(chicago, 'Millennium Park; The Art Institute of Chicago'),
  eventsPrompt: (f) => f(chicago, '2026-11-01 to 2026-11-05'),
  flightsPrompt: (f) => f(chicago, ''),
};

function allPrompts() {
  const found = Object.keys(gemini).filter((n) => n.endsWith('Prompt'));
  assert.deepEqual(found.sort(), Object.keys(builders).sort(), 'a prompt builder was added or removed; add it here');
  return [
    ...found.map((n) => [n, builders[n](gemini[n])]),
    ['flightsPrompt with JFK', flightsPrompt(chicago, 'JFK')],
  ];
}

test('with no home airport the flights prompt says "a US airport"', () => {
  for (const home of ['', undefined, null]) {
    const p = flightsPrompt(chicago, home);
    assert.match(p, /^Flight-planning guidance from a US airport to Chicago/);
    assert.match(p, /realistic range from a US airport/);
    assert.doesNotMatch(p, /Midwest|mid-size/i);
  }
});

test('with a home airport the flights prompt uses it, not the fallback', () => {
  const p = flightsPrompt(chicago, 'JFK');
  assert.match(p, /from JFK to Chicago/);
  assert.doesNotMatch(p, /a US airport/);
});

test('no prompt the code builds contains an em or en dash', () => {
  for (const [name, p] of allPrompts()) {
    assert.doesNotMatch(p, /[\u2013\u2014]/, `${name} has an em or en dash`);
  }
});

test('every prompt tells the model to use no em or en dashes', () => {
  for (const [name, p] of allPrompts()) {
    assert.match(p, /Do not use em dashes or en dashes/, `${name} is missing the no-dash line`);
  }
});

test('the dash check itself catches a dash (control)', () => {
  assert.match('Mar\u2013May', /[\u2013\u2014]/);
  assert.match('set \u2014 guidance', /[\u2013\u2014]/);
});
