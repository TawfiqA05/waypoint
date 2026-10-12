import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAirportCode, usableAirport, cleanAirportInput, openingNote, leaveAirportBox,
  SAVED_BAD_NOTE, TYPED_BAD_NOTE,
} from './airport.js';
import { getSettings } from './storage.js';

test('airport rule: JFK passes', () => {
  assert.equal(isAirportCode('JFK'), true);
  assert.equal(usableAirport('JFK'), 'JFK');
});

test('airport rule: everything that is not three letters fails, without throwing', () => {
  for (const v of ['', 'JF', 'KJFK', 'JF1', 'J K', 'jfk', undefined, null, 123, {}, ['JFK']]) {
    assert.equal(isAirportCode(v), false, `${JSON.stringify(v)} should fail`);
    assert.equal(usableAirport(v), '', `${JSON.stringify(v)} should be treated as not set`);
  }
});

test('airport rule: typing "jfk" or " jfk " gives JFK', () => {
  assert.equal(cleanAirportInput('jfk'), 'JFK');
  assert.equal(cleanAirportInput(' jfk '), 'JFK');
  assert.equal(cleanAirportInput('j-f 1k9x'), 'JFK');
  assert.equal(cleanAirportInput(undefined), '');
  assert.equal(cleanAirportInput(null), '');
});

test('airport rule: leaving the box saves three letters or empty, nothing else', () => {
  assert.deepEqual(leaveAirportBox('JFK', true), { save: 'JFK', note: null });
  assert.deepEqual(leaveAirportBox('', true), { save: '', note: null });
  assert.deepEqual(leaveAirportBox('JF', true), { save: undefined, note: 'typed' });
  assert.deepEqual(leaveAirportBox('KJFK', false, 'saved'), { save: undefined, note: 'saved' });
});

test('airport rule: no note for an empty box', () => {
  assert.equal(openingNote(''), null);
  assert.equal(openingNote(undefined), null);
  assert.equal(leaveAirportBox('', true).note, null);
  assert.equal(openingNote('JFK'), null);
  assert.equal(openingNote('KJFK'), 'saved');
});

test('airport rule: the two notes read as agreed', () => {
  assert.equal(SAVED_BAD_NOTE, "Flights won't use this until it's a three-letter code, like JFK.");
  assert.equal(TYPED_BAD_NOTE, 'Not saved. Use a three-letter code, like JFK.');
});

test('airport rule: a failing saved value stays in storage unchanged', () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  try {
    store.set('wp_user_id', 'u_test');
    const raw = JSON.stringify({ user_id: 'u_test', homeAirport: 'KJFK' });
    store.set('wp_settings', raw);

    const saved = getSettings().homeAirport;
    assert.equal(saved, 'KJFK');
    assert.equal(usableAirport(saved), '');
    assert.equal(openingNote(saved), 'saved');
    // Opening Settings and leaving without typing writes nothing.
    assert.equal(leaveAirportBox(saved, false, openingNote(saved)).save, undefined);
    // Typing something that fails writes nothing either.
    assert.equal(leaveAirportBox('JF', true).save, undefined);
    assert.equal(store.get('wp_settings'), raw);
  } finally {
    delete globalThis.localStorage;
  }
});
