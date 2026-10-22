import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** three 0.183 recomputes getRootNode() during dispose. React passive cleanup
 * can run after removal, so its document keyboard handlers survive disconnect.
 * Retain the original event root and remove those two pinned-version hooks. */
export function disposeOrbitControls(controls: OrbitControls, eventRoot: EventTarget) {
  controls.dispose();
  const hooks = controls as unknown as {
    _interceptControlDown?: EventListener;
    _interceptControlUp?: EventListener;
  };
  if (hooks._interceptControlDown) eventRoot.removeEventListener('keydown', hooks._interceptControlDown, true);
  if (hooks._interceptControlUp) eventRoot.removeEventListener('keyup', hooks._interceptControlUp, true);
}
