import { Injectable, inject } from '@angular/core';
import { WORLD_CONFIG } from '../config/world.config';
import { TreeGeneratorService, WorldBuilder } from './tree-generator.service';
import { RiverGeneratorService } from './river-generator.service';
import { TerrainCell, TerrainMap } from './world/terrain-map';
import { Random } from '../utils/random';

@Injectable({
  providedIn: 'root'
})
export class WorldGeneratorService {
  private treeGenerator = inject(TreeGeneratorService);
  private riverGenerator = inject(RiverGeneratorService);
  private readonly spawnSafeRadius = WORLD_CONFIG.spawnSafeRadius ?? 12;

  generate(world: WorldBuilder, seed: number) {
    const random = new Random(seed);
    const terrainMap = this.generateTerrainMap(seed);
    this.carveRivers(terrainMap);
    this.buildTerrain(terrainMap, world, random);
    this.createHouse(8, 1, 8, world);
  }

  private generateTerrainMap(seed: number): TerrainMap {
    const map = new TerrainMap(WORLD_CONFIG.size, this.spawnSafeRadius);
    const halfSize = WORLD_CONFIG.size / 2;

    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        map.setCell(this.createCell(x, z, seed));
      }
    }

    return map;
  }

  private createCell(x: number, z: number, seed: number): TerrainCell {
    const distanceToCenter = Math.sqrt(x * x + z * z);

    return {
      x,
      z,
      height: this.sampleHeight(x, z, seed, distanceToCenter),
      biome: this.sampleBiome(x, z, seed),
      surface: 'grass',
      waterDepth: 0,
      distanceToCenter
    };
  }

  private sampleHeight(x: number, z: number, seed: number, distanceToCenter: number): number {
    const nx = (x + seed) * 0.05;
    const nz = (z + seed) * 0.05;
    const heightNoise = Math.sin(nx) * Math.cos(nz) +
                        Math.sin(nx * 0.5) * Math.cos(nz * 0.5) * 2;

    let y = Math.floor(Math.max(0, heightNoise * 2 + 1));
    if (distanceToCenter < this.spawnSafeRadius) {
      y = 0;
    }

    return y;
  }

  private sampleBiome(x: number, z: number, seed: number): 'forest' | 'plains' {
    const bx = (x + seed) * 0.02;
    const bz = (z + seed) * 0.02;
    const biomeNoise = Math.sin(bx) * Math.cos(bz);
    return biomeNoise > 0 ? 'forest' : 'plains';
  }

  private carveRivers(map: TerrainMap) {
    const config = WORLD_CONFIG.rivers ?? { count: 2, width: 2 };
    this.riverGenerator.carveRivers(map, config);
  }

  private buildTerrain(map: TerrainMap, world: WorldBuilder, random: Random) {
    map.forEach(cell => {
      if (cell.surface === 'water') {
        this.buildWaterColumn(cell, world);
      } else {
        this.buildLandColumn(cell, world);
        this.trySpawnTree(cell, world, random);
      }
    });
  }

  private buildLandColumn(cell: TerrainCell, world: WorldBuilder) {
    world.addBlock(cell.x, cell.height, cell.z, 'grass');
    
    // Layer of dirt below grass
    world.addBlock(cell.x, cell.height - 1, cell.z, 'dirt');

    // Stone layer starting from the 3rd block from surface (height - 2)
    const stoneStart = cell.height - 2;
    const stoneDepth = 30;
    for (let y = stoneStart; y > stoneStart - stoneDepth; y--) {
      world.addBlock(cell.x, y, cell.z, 'stone');
    }
  }

  private buildWaterColumn(cell: TerrainCell, world: WorldBuilder) {
    const depth = Math.max(1, cell.waterDepth);
    const waterBase = cell.height;
    const waterTop = waterBase + depth - 1;

    for (let y = waterBase; y <= waterTop; y++) {
      world.addBlock(cell.x, y, cell.z, 'water');
    }

    // Dirt under water
    const groundY = waterBase - 1;
    world.addBlock(cell.x, groundY, cell.z, 'dirt');
    world.addBlock(cell.x, groundY - 1, cell.z, 'dirt');

    // Stone layer under water
    const stoneStart = groundY - 2;
    const stoneDepth = 30;
    for (let y = stoneStart; y > stoneStart - stoneDepth; y--) {
      world.addBlock(cell.x, y, cell.z, 'stone');
    }
  }

  private trySpawnTree(cell: TerrainCell, world: WorldBuilder, random: Random) {
    if (cell.surface !== 'grass') return;
    if (cell.distanceToCenter <= this.spawnSafeRadius) return;

    const spawnChance = cell.biome === 'forest' ? 0.08 : 0.005;
    if (random.chance(spawnChance)) {
      this.treeGenerator.generate(cell.x, cell.height + 1, cell.z, world, random);
    }
  }

  private createHouse(startX: number, startY: number, startZ: number, world: WorldBuilder) {
    const width = 6, depth = 6, height = 4;
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        for(let y = 0; y < height; y++) {
          if(x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
            if(x === Math.floor(width/2) && z === 0 && y < 2) continue; 
            if(x === 0 && z === Math.floor(depth/2) && y === 1) continue; 
            if(x === width - 1 && z === Math.floor(depth/2) && y === 1) continue;
            world.addBlock(startX + x, startY + y, startZ + z, 'wood');
          }
        }
      }
    }
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        world.addBlock(startX + x, startY + height, startZ + z, 'wood');
      }
    }
  }
}
