import { Injectable } from '@angular/core';
import { TerrainMap } from './world/terrain-map';

type Edge = 'north' | 'south' | 'east' | 'west';

interface RiverPoint {
  x: number;
  z: number;
}

interface RiverEndpoint extends RiverPoint {
  edge: Edge;
}

export interface RiverConfig {
  count: number;
  width: number;
}

@Injectable({
  providedIn: 'root'
})
export class RiverGeneratorService {
  carveRivers(map: TerrainMap, config: Partial<RiverConfig> = {}) {
    const settings: RiverConfig = {
      count: 2,
      width: 2,
      ...config
    };

    for (let i = 0; i < settings.count; i++) {
      const path = this.buildRiverPath(map);
      if (!path.length) continue;
      path.forEach(point => map.markRiver(point.x, point.z, settings.width));
    }
  }

  private buildRiverPath(map: TerrainMap): RiverPoint[] {
    const start = this.pickEdgePoint(map);
    if (!start) return [];

    const target = this.pickOppositeEdgePoint(map, start.edge);
    const path: RiverPoint[] = [];
    const visited = new Set<string>();
    let current: RiverPoint = { x: start.x, z: start.z };
    const maxSteps = map.getSize() * 3;

    for (let step = 0; step < maxSteps; step++) {
      const rounded = { x: Math.round(current.x), z: Math.round(current.z) };
      if (!map.hasCell(rounded.x, rounded.z)) break;

      const key = `${rounded.x},${rounded.z}`;
      if (visited.has(key)) break;
      visited.add(key);

      path.push(rounded);

      if (map.isEdge(rounded.x, rounded.z) && step > map.getSize() / 4) {
        break;
      }

      const next = this.findNextStep(rounded, target, map);
      if (!next) break;
      current = next;
    }

    return path;
  }

  private findNextStep(current: RiverPoint, target: RiverPoint, map: TerrainMap): RiverPoint | null {
    const neighbors = this.getNeighborCoords(current);
    let best: { point: RiverPoint; score: number } | null = null;

    for (const neighbor of neighbors) {
      if (!map.hasCell(neighbor.x, neighbor.z)) continue;
      const cell = map.getCell(neighbor.x, neighbor.z)!;

      const heightScore = cell.height;
      const distanceScore = this.distance(neighbor, target) * 0.02;
      const randomScore = Math.random() * 0.3;
      const totalScore = heightScore + distanceScore + randomScore;

      if (!best || totalScore < best.score) {
        best = { point: neighbor, score: totalScore };
      }
    }

    return best?.point ?? null;
  }

  private getNeighborCoords(current: RiverPoint): RiverPoint[] {
    const deltas = [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
      { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }, { x: -1, z: -1 }
    ];

    return deltas.map(delta => ({ x: current.x + delta.x, z: current.z + delta.z }));
  }

  private pickEdgePoint(map: TerrainMap): RiverEndpoint | null {
    const edges: Edge[] = ['north', 'south', 'east', 'west'];
    const edge = edges[Math.floor(Math.random() * edges.length)];

    switch (edge) {
      case 'north':
        return { edge, x: this.randomBetween(map.getMinX(), map.getMaxX()), z: map.getMinZ() };
      case 'south':
        return { edge, x: this.randomBetween(map.getMinX(), map.getMaxX()), z: map.getMaxZ() };
      case 'east':
        return { edge, x: map.getMaxX(), z: this.randomBetween(map.getMinZ(), map.getMaxZ()) };
      case 'west':
        return { edge, x: map.getMinX(), z: this.randomBetween(map.getMinZ(), map.getMaxZ()) };
      default:
        return null;
    }
  }

  private pickOppositeEdgePoint(map: TerrainMap, startEdge: Edge): RiverPoint {
    switch (startEdge) {
      case 'north':
        return { x: this.randomBetween(map.getMinX(), map.getMaxX()), z: map.getMaxZ() };
      case 'south':
        return { x: this.randomBetween(map.getMinX(), map.getMaxX()), z: map.getMinZ() };
      case 'east':
        return { x: map.getMinX(), z: this.randomBetween(map.getMinZ(), map.getMaxZ()) };
      case 'west':
      default:
        return { x: map.getMaxX(), z: this.randomBetween(map.getMinZ(), map.getMaxZ()) };
    }
  }

  private distance(a: RiverPoint, b: RiverPoint) {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.hypot(dx, dz);
  }

  private randomBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

