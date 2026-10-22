import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionToVolume, volumeToPosition } from '../src/lib/work-lab/volume.ts';
test('audio control maps 5×, 10× and 20× to its endpoints and midpoint', () => {
  for (const [position, gain] of [[0, 1.5], [50, 3], [100, 6]]) {
    assert.equal(positionToVolume(position), gain);
    assert.equal(volumeToPosition(gain), position);
  }
  assert.equal(positionToVolume(-10), 1.5);
  assert.equal(positionToVolume(200), 6);
});
