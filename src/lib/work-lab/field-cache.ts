/** Reuses the archive's integer/half-row samples without allocating nested Maps per frame. */
export class FrameFieldCache {
  private values: Float64Array;
  private samples: number;
  private lane = 0;
  private row = 0;
  private lanes: number;
  private rows: number;
  constructor(lanes: number, rows: number) {
    this.lanes = lanes;
    this.rows = rows;
    this.samples = rows * 2 + 1;
    this.values = new Float64Array(lanes * this.samples);
    this.begin(0, 0);
  }
  begin(lane: number, row: number) {
    this.lane = Math.floor(lane) - Math.floor(this.lanes / 2);
    this.row = Math.floor(row) - Math.floor(this.rows / 2) - .5;
    this.values.fill(NaN);
  }
  read(row: number, lane: number, calculate: (row: number, lane: number) => number): number {
    const column = lane - this.lane, sample = (row - this.row) * 2;
    if (!Number.isInteger(column) || !Number.isInteger(sample) || column < 0 || column >= this.lanes || sample < 0 || sample >= this.samples)
      return calculate(row, lane);
    const index = column * this.samples + sample;
    let value = this.values[index];
    if (Number.isNaN(value)) this.values[index] = value = calculate(row, lane);
    return value;
  }
}
