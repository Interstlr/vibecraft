import { Injectable } from '@angular/core';
import { BlockPlacerService } from '../world/block-placer.service';

@Injectable({
  providedIn: 'root',
})
export class LeavesSystemService {
  // Map of pending checks: key -> remaining time
  private pendingChecks = new Map<string, number>();
  private readonly DECAY_RADIUS = 5; // Radius to look for wood support
  
  constructor(private blockPlacer: BlockPlacerService) {
    console.log('[LeavesSystem] Initialized');
    this.blockPlacer.onBlockUpdate((x, y, z, type, action) => {
      this.handleBlockUpdate(x, y, z, type, action);
    });
  }

  update(delta: number) {
    if (this.pendingChecks.size === 0) return;

    const finishedKeys: string[] = [];

    // Process timer
    for (const [key, time] of this.pendingChecks.entries()) {
      const newTime = time - delta;
      if (newTime <= 0) {
        finishedKeys.push(key);
      } else {
        this.pendingChecks.set(key, newTime);
      }
    }

    // Process finished items
    for (const key of finishedKeys) {
      this.pendingChecks.delete(key);
      const [x, y, z] = key.split(',').map(Number);
      
      // Re-validate existence (might have been removed already)
      const currentType = this.blockPlacer.getBlockType(x, y, z);
      if (currentType !== 'leaves') continue;

      this.checkDecay(x, y, z);
    }
  }

  private handleBlockUpdate(x: number, y: number, z: number, type: string, action: 'add' | 'remove') {
    // If wood removed -> check surrounding leaves
    // If leaves removed -> check surrounding leaves (chain reaction)
    if (action === 'remove' && (type === 'wood' || type === 'leaves')) {
      this.scheduleNeighborUpdates(x, y, z);
    }
  }

  private scheduleNeighborUpdates(cx: number, cy: number, cz: number) {
    // Check 6 neighbors
    const neighbors = [
      [cx + 1, cy, cz], [cx - 1, cy, cz],
      [cx, cy + 1, cz], [cx, cy - 1, cz],
      [cx, cy, cz + 1], [cx, cy, cz - 1]
    ];

    for (const [nx, ny, nz] of neighbors) {
      const type = this.blockPlacer.getBlockType(nx, ny, nz);
      if (type === 'leaves') {
        const key = `${nx},${ny},${nz}`;
        // Schedule check with random delay if not already scheduled
        if (!this.pendingChecks.has(key)) {
          // Delay between 0.5s and 5s for "gradual decay" effect
          const delay = Math.random() * 4.5 + 0.5; 
          this.pendingChecks.set(key, delay);
        }
      }
    }
  }

  private checkDecay(x: number, y: number, z: number) {
    if (this.hasWoodSupport(x, y, z)) {
      return; // Supported by wood nearby
    }

    // No support -> Decay!
    // console.log(`[LeavesSystem] Decaying leaf at ${x},${y},${z}`);
    this.blockPlacer.removeBlock(x, y, z);
    // Removing this block will trigger handleBlockUpdate -> scheduleNeighborUpdates automatically
  }

  private hasWoodSupport(startX: number, startY: number, startZ: number): boolean {
    // BFS to find 'wood' within DECAY_RADIUS (Manhattan distance or Path distance)
    // We use Path distance (steps through leaves)
    
    const queue: [number, number, number, number][] = [[startX, startY, startZ, 0]];
    const visited = new Set<string>();
    visited.add(`${startX},${startY},${startZ}`);

    while (queue.length > 0) {
      const [cx, cy, cz, dist] = queue.shift()!;

      // If we reached max radius, stop this branch
      if (dist >= this.DECAY_RADIUS) continue;

      const neighbors = [
        [cx + 1, cy, cz], [cx - 1, cy, cz],
        [cx, cy + 1, cz], [cx, cy - 1, cz],
        [cx, cy, cz + 1], [cx, cy, cz - 1]
      ];

      for (const [nx, ny, nz] of neighbors) {
        const nKey = `${nx},${ny},${nz}`;
        if (visited.has(nKey)) continue;

        const type = this.blockPlacer.getBlockType(nx, ny, nz);
        
        if (type === 'wood') {
          return true; // Found wood!
        }

        // Can only propagate support through other leaves
        if (type === 'leaves') {
          visited.add(nKey);
          queue.push([nx, ny, nz, dist + 1]);
        }
      }
    }

    return false;
  }
}
