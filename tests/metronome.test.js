import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beatsPerBar, parseBpm, clampBpm } from '../src/features/metronome.js';
import { durationSeconds, nearestLevel, pxPerSecond } from '../src/features/autoscroll.js';

test('metrónomo: compás y tempo', () => {
  assert.equal(beatsPerBar('4/4'), 4);
  assert.equal(beatsPerBar('6/8'), 6);
  assert.equal(beatsPerBar(' 3 / 4 '), 3);
  assert.equal(beatsPerBar(''), 4);
  assert.equal(beatsPerBar('6:58'), 4);
  assert.equal(parseBpm('136'), 136);
  assert.equal(parseBpm('♩ = 72'), 72);
  assert.equal(parseBpm(''), null);
  assert.equal(parseBpm('5'), null);
  assert.equal(clampBpm(400), 260);
  assert.equal(clampBpm(10), 30);
});

test('desplazamiento: duración y niveles', () => {
  assert.equal(durationSeconds('6:58'), 418);
  assert.equal(durationSeconds('0:10'), null); // demasiado corta para ser una canción
  assert.equal(durationSeconds('4/4'), null);
  for (let l = 1; l <= 20; l++) assert.equal(nearestLevel(pxPerSecond(l)), l);
  assert.equal(nearestLevel(0.1), 1);
  assert.equal(nearestLevel(9999), 20);
});
