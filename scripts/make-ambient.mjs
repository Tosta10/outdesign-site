import { writeFile } from "node:fs/promises";
// Original, procedurally synthesized ambient chord. No external recording.
const rate = 22050,
  seconds = 12,
  samples = rate * seconds;
const data = Buffer.alloc(44 + samples * 2);
data.write("RIFF");
data.writeUInt32LE(data.length - 8, 4);
data.write("WAVEfmt ", 8);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(1, 22);
data.writeUInt32LE(rate, 24);
data.writeUInt32LE(rate * 2, 28);
data.writeUInt16LE(2, 32);
data.writeUInt16LE(16, 34);
data.write("data", 36);
data.writeUInt32LE(samples * 2, 40);
const notes = [130.8128, 196, 261.6256, 329.6276];
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const envelope = Math.min(1, t / 1.7) * Math.min(1, (seconds - t) / 3);
  const value =
    notes.reduce(
      (v, f, j) =>
        v +
        Math.sin(2 * Math.PI * f * t + 0.025 * Math.sin(t * 0.6 + j)) *
          (0.7 + 0.3 * Math.sin(t * 0.22 + j)),
      0,
    ) / notes.length;
  data.writeInt16LE(Math.round(value * envelope * 5200), 44 + i * 2);
}
await writeFile(new URL("../public/assets/ambient.wav", import.meta.url), data);
