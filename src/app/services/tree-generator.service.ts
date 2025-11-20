import { Injectable } from '@angular/core';

export interface WorldBuilder {
  addBlock(x: number, y: number, z: number, type: string): void;
  hasBlock(x: number, y: number, z: number): boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TreeGeneratorService {
  
  generate(x: number, y: number, z: number, world: WorldBuilder) {
    const height = 4 + Math.floor(Math.random() * 2);

    // Trunk
    for(let i = 0; i < height; i++) {
      world.addBlock(x, y + i, z, 'wood');
    }

    // Leaves
    const leafStart = y + height - 2;
    for(let lx = x - 2; lx <= x + 2; lx++) {
      for(let lz = z - 2; lz <= z + 2; lz++) {
        for(let ly = leafStart; ly <= leafStart + 2; ly++) {
          // Manhattan distance approximation for rounded shape
          if (Math.abs(lx - x) + Math.abs(lz - z) + Math.abs(ly - leafStart - 1) <= 3) {
             if(!world.hasBlock(lx, ly, lz)) {
                 world.addBlock(lx, ly, lz, 'leaves');
             }
          }
        }
      }
    }
  }
}

