import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { disposeOrbitControls } from '../src/lib/work-lab/orbit-lifetime.ts';

class Root extends EventTarget {
  registered = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    if (callback) this.registered.add(callback);
    super.addEventListener(type, callback, options);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    if (callback) this.registered.delete(callback);
    super.removeEventListener(type, callback, options);
  }
}
test('OrbitControls removes document keyboard hooks after React detaches its canvas, including held Control', () => {
  const root = new Root();
  const canvas = Object.assign(new EventTarget(), {
    ownerDocument: root, style: {}, attached: true,
    getRootNode() { return this.attached ? root : this; },
  });
  const controls = new OrbitControls(new PerspectiveCamera(), canvas as unknown as HTMLElement);
  assert.equal(root.registered.size, 1);
  root.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Control' }));
  assert.equal(root.registered.size, 2);
  canvas.attached = false;
  disposeOrbitControls(controls, root);
  assert.equal(root.registered.size, 0);
});
