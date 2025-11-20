import { Injectable, inject } from '@angular/core';
import { WORLD_CONFIG } from '../config/world.config';
import { TreeGeneratorService, WorldBuilder } from './tree-generator.service';

@Injectable({
  providedIn: 'root'
})
export class WorldGeneratorService {
  private treeGenerator = inject(TreeGeneratorService);

  generate(world: WorldBuilder) {
    const size = WORLD_CONFIG.size;
    const halfSize = size / 2;

    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        let y = 0;
        if (Math.random() < WORLD_CONFIG.hillFrequency) y = 1;
        
        world.addBlock(x, y, z, 'grass');
        if(y > 0) world.addBlock(x, y-1, z, 'dirt');
        
        if (x > -5 && x < 5 && z > -5 && z < 5) {
          // spawn area clear
        } else if (Math.random() < WORLD_CONFIG.treeDensity) {
          this.treeGenerator.generate(x, y + 1, z, world);
        }
      }
    }
    this.createHouse(5, 1, 5, world);
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

