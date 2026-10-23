import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
test('service worker parses', () => { assert.doesNotThrow(() => new vm.Script(fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'))); });
test('reciter photos are well-formed', () => {
  const j = JSON.parse(fs.readFileSync(new URL('../public/content/audio/reciter-photos.json', import.meta.url), 'utf8'));
  for (const [id, p] of Object.entries(j.photos)) { assert.match(p.src, /^https:\/\/upload\.wikimedia\.org\//, id); assert.ok(p.licence && p.crop.length === 3 && p.w > 0 && p.h > 0, id); }
});
