/** Original gain ceiling was .3; logarithmic control puts 10× at its midpoint. */
export const positionToVolume = (position: number) => 1.5 * 2 ** (Math.max(0, Math.min(100, position)) / 50);
export const volumeToPosition = (volume: number) => Math.max(0, Math.min(100, 50 * Math.log2(Math.max(1.5, volume) / 1.5)));
