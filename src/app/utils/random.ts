export class Random {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns a pseudo-random number between 0 (inclusive) and 1 (exclusive)
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  // Returns a pseudo-random integer between min (inclusive) and max (inclusive)
  range(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  
  // Returns true with the given probability (0-1)
  chance(probability: number): boolean {
      return this.next() < probability;
  }
}

