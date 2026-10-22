/** Original synthesized tones. No recordings or sampled instruments. */
export class LabAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private drones: OscillatorNode[] = [];
  private playing = false;
  async enable(volume: number, ambient: boolean) {
    this.context ||= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.limiter.threshold.value = -3;
      this.limiter.knee.value = 3;
      this.limiter.ratio.value = 12;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.15;
      this.master.connect(this.limiter).connect(this.context.destination);
    }
    await this.context.resume();
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(6, Number.isFinite(volume) ? volume : 0)), this.context.currentTime, 0.15);
    if (ambient && !this.playing) {
      this.playing = true;
      for (const frequency of [110, 164.81, 220.2]) {
        const oscillator = this.context.createOscillator(),
          gain = this.context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.value = 0.035;
        oscillator.connect(gain).connect(this.master);
        oscillator.start();
        this.drones.push(oscillator);
      }
    } else if (!ambient) {
      this.drones.forEach((o) => o.stop());
      this.drones = [];
      this.playing = false;
    }
  }
  tick(index = 0) {
    if (!this.context || !this.master || this.context.state !== "running")
      return;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(440 * 2 ** ((index % 5) / 12), now);
    oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(now + 0.12);
    oscillator.onended = () => {
      gain.disconnect();
      oscillator.disconnect();
    };
  }
  pause() {
    void this.context?.suspend();
  }
  resume() {
    if (this.context) void this.context.resume().catch(() => {});
  }
  dispose() {
    this.drones.forEach((o) => o.stop());
    this.drones = [];
    void this.context?.close();
  }
}
