let software: boolean | undefined;
/** Probe once, release immediately, so software rendering can avoid allocating
 * a multisampled back buffer before the real scene context is created. */
export function usesSoftwareRenderer(): boolean {
  if (software !== undefined) return software;
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
  if (!gl) return software = false;
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const name = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : '';
  software = /SwiftShader|llvmpipe|softpipe|software|Microsoft Basic Render/i.test(name);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return software;
}
