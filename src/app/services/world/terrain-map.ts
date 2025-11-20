export type BiomeType = 'forest' | 'plains';
export type SurfaceType = 'grass' | 'water';

export interface TerrainCell {
  x: number;
  z: number;
  height: number;
  biome: BiomeType;
  surface: SurfaceType;
  waterDepth: number;
  distanceToCenter: number;
}

export class TerrainMap {
  private readonly halfSize: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly minZ: number;
  private readonly maxZ: number;
  private readonly cells = new Map<string, TerrainCell>();

  constructor(private readonly size: number, private readonly protectedRadius: number = 10) {
    this.halfSize = size / 2;
    this.minX = -this.halfSize;
    this.maxX = this.halfSize - 1;
    this.minZ = -this.halfSize;
    this.maxZ = this.halfSize - 1;
  }

  setCell(cell: TerrainCell) {
    this.cells.set(this.key(cell.x, cell.z), cell);
  }

  getCell(x: number, z: number): TerrainCell | undefined {
    return this.cells.get(this.key(x, z));
  }

  hasCell(x: number, z: number): boolean {
    return this.cells.has(this.key(x, z));
  }

  forEach(callback: (cell: TerrainCell) => void) {
    this.cells.forEach(callback);
  }

  markRiver(x: number, z: number, halfWidth: number) {
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      for (let dz = -halfWidth; dz <= halfWidth; dz++) {
        const manhattan = Math.abs(dx) + Math.abs(dz);
        if (manhattan > halfWidth) continue;

        const cell = this.getCell(x + dx, z + dz);
        if (!cell) continue;
        if (cell.distanceToCenter <= this.protectedRadius) continue;

        cell.surface = 'water';
        cell.waterDepth = Math.max(cell.waterDepth, 2);
        const loweredHeight = Math.max(-2, cell.height - 1);
        cell.height = Math.min(cell.height, loweredHeight);
      }
    }
  }

  isInside(x: number, z: number): boolean {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }

  isEdge(x: number, z: number): boolean {
    return x === this.minX || x === this.maxX || z === this.minZ || z === this.maxZ;
  }

  getSize() {
    return this.size;
  }

  getMinX() {
    return this.minX;
  }

  getMaxX() {
    return this.maxX;
  }

  getMinZ() {
    return this.minZ;
  }

  getMaxZ() {
    return this.maxZ;
  }

  private key(x: number, z: number) {
    return `${x},${z}`;
  }
}

