import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { SceneManagerService } from '../core/scene-manager.service';

const PIXEL_CRACK_PATTERNS: string[][] = [
  [
    '................',
    '................',
    '................',
    '................',
    '........#.......',
    '.......###......',
    '........#.......',
    '........#.......',
    '........#.......',
    '.......###......',
    '........#.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '................',
    '.......#........',
    '......###.......',
    '.....##.##......',
    '......###.......',
    '.......#........',
    '........#.......',
    '.......##.......',
    '......####......',
    '.....##.##......',
    '......###.......',
    '.......#........',
    '................',
    '................',
    '................',
  ],
  [
    '................',
    '.....#...#......',
    '....###.###.....',
    '...##.###.##....',
    '....###.###.....',
    '.....#...#......',
    '.....##.##......',
    '....###.###.....',
    '...####.####....',
    '....###.###.....',
    '.....##.##......',
    '......###.......',
    '.......#........',
    '................',
    '................',
    '................',
  ],
  [
    '...#..###..#....',
    '..###.###.###...',
    '.###.#####.###..',
    '.##.#######.##..',
    '.###.#####.###..',
    '..###.###.###...',
    '...##.###.##....',
    '...###.###.###..',
    '..####.###.####.',
    '..###.#####.###.',
    '...###.###.###..',
    '....##.###.##...',
    '.....#######....',
    '......#####.....',
    '.......###......',
    '........#.......',
  ],
  [
    '.###.#####.###..',
    '###.#######.###.',
    '##.#########.##.',
    '##.#########.##.',
    '##.#########.##.',
    '###.#######.###.',
    '.###.#####.###..',
    '..###.###.###...',
    '..###########...',
    '..###########...',
    '...#########....',
    '....#######.....',
    '.....#####......',
    '......###.......',
    '.......#........',
    '................',
  ],
];

@Injectable({
  providedIn: 'root',
})
export class CrackOverlayService {
  private readonly CRACK_STAGE_COUNT = 5;
  private crackMaterials: THREE.MeshBasicMaterial[] = [];
  private crackOverlayMesh: THREE.Mesh | null = null;
  private currentCrackStage = -1;
  private crackBlockKey: string | null = null;

  constructor(private sceneManager: SceneManagerService) {}

  initialize() {
    const renderer = this.sceneManager.getRenderer();
    const textures = this.createCrackTextures(this.CRACK_STAGE_COUNT, renderer);
    if (!textures.length) {
      return;
    }

    this.crackMaterials = textures.map((texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        side: THREE.DoubleSide,
      });
    });

    const overlayGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    this.crackOverlayMesh = new THREE.Mesh(overlayGeometry, this.crackMaterials[0]);
    this.crackOverlayMesh.visible = false;
    this.crackOverlayMesh.renderOrder = 5;
    this.sceneManager.getScene().add(this.crackOverlayMesh);
  }

  show(key: string, position: THREE.Vector3, progressRatio: number) {
    if (!this.crackOverlayMesh || this.crackMaterials.length === 0) {
      return;
    }

    this.crackBlockKey = key;
    const clamped = THREE.MathUtils.clamp(progressRatio, 0, 0.9999);
    const stage = Math.min(this.CRACK_STAGE_COUNT - 1, Math.floor(clamped * this.CRACK_STAGE_COUNT));

    if (stage !== this.currentCrackStage) {
      this.crackOverlayMesh.material = this.crackMaterials[stage];
      this.currentCrackStage = stage;
    }

    this.crackOverlayMesh.visible = true;
    this.crackOverlayMesh.position.copy(position);
  }

  hide() {
    this.currentCrackStage = -1;
    this.crackBlockKey = null;
    if (this.crackOverlayMesh) {
      this.crackOverlayMesh.visible = false;
    }
  }

  getActiveBlockKey(): string | null {
    return this.crackBlockKey;
  }

  private createCrackTextures(count: number, renderer: THREE.WebGLRenderer): THREE.Texture[] {
    const textures: THREE.Texture[] = [];
    const gridResolution = 32;
    const pixelScale = 8;
    const canvasSize = gridResolution * pixelScale;

    for (let stage = 1; stage <= count; stage++) {
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }

      if ('imageSmoothingEnabled' in ctx) {
        (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = false;
      }

      const stageIndex = stage - 1;
      const opacity = THREE.MathUtils.lerp(0.35, 0.85, stageIndex / Math.max(1, count - 1));
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      const mask = this.getCrackMaskForStage(stageIndex, gridResolution);
      ctx.fillStyle = `rgba(30, 30, 30, ${opacity})`;

      for (let y = 0; y < gridResolution; y++) {
        for (let x = 0; x < gridResolution; x++) {
          if (!mask[y][x]) {
            continue;
          }
          ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale);
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      textures.push(texture);
    }

    return textures;
  }

  private getCrackMaskForStage(stageIndex: number, resolution: number): boolean[][] {
    const baseSize = PIXEL_CRACK_PATTERNS[0]?.length || 16;
    const baseGrid = Array.from({ length: baseSize }, () => Array(baseSize).fill(false));
    const rng = this.seededRandom(stageIndex * 92821 + 137);
    const maxPatternIndex = Math.min(PIXEL_CRACK_PATTERNS.length - 1, stageIndex);
    const stampCount = Math.max(1, 2 + stageIndex * 2);

    for (let i = 0; i < stampCount; i++) {
      const patternIndex = Math.floor(rng() * (maxPatternIndex + 1));
      const pattern = PIXEL_CRACK_PATTERNS[patternIndex];
      const matrix = this.getTransformedPattern(pattern, rng);
      const offsetX = Math.floor(rng() * baseSize);
      const offsetY = Math.floor(rng() * baseSize);
      this.paintPattern(baseGrid, matrix, offsetX, offsetY);
    }

    return this.scaleBooleanGrid(baseGrid, resolution);
  }

  private getTransformedPattern(pattern: string[], rng: () => number): boolean[][] {
    let matrix = this.patternToBooleanMatrix(pattern);
    const rotateSteps = Math.floor(rng() * 4);
    for (let i = 0; i < rotateSteps; i++) {
      matrix = this.rotateMatrix90(matrix);
    }

    if (rng() < 0.5) {
      matrix = this.flipMatrix(matrix, true);
    }
    if (rng() < 0.35) {
      matrix = this.flipMatrix(matrix, false);
    }

    return matrix;
  }

  private patternToBooleanMatrix(pattern: string[]): boolean[][] {
    const size = pattern.length;
    const matrix = Array.from({ length: size }, () => Array(size).fill(false));
    for (let y = 0; y < size; y++) {
      const row = pattern[y] ?? '';
      for (let x = 0; x < row.length; x++) {
        matrix[y][x] = row[x] === '#';
      }
    }
    return matrix;
  }

  private rotateMatrix90(matrix: boolean[][]): boolean[][] {
    const size = matrix.length;
    const rotated = Array.from({ length: size }, () => Array(size).fill(false));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        rotated[x][size - y - 1] = matrix[y][x];
      }
    }
    return rotated;
  }

  private flipMatrix(matrix: boolean[][], horizontal: boolean): boolean[][] {
    const size = matrix.length;
    const flipped = Array.from({ length: size }, () => Array(size).fill(false));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (horizontal) {
          flipped[y][size - x - 1] = matrix[y][x];
        } else {
          flipped[size - y - 1][x] = matrix[y][x];
        }
      }
    }
    return flipped;
  }

  private paintPattern(baseGrid: boolean[][], pattern: boolean[][], offsetX: number, offsetY: number) {
    const size = baseGrid.length;
    const patternSize = pattern.length;
    for (let y = 0; y < patternSize; y++) {
      for (let x = 0; x < patternSize; x++) {
        if (!pattern[y][x]) {
          continue;
        }
        const targetX = (offsetX + x) % size;
        const targetY = (offsetY + y) % size;
        baseGrid[targetY][targetX] = true;
      }
    }
  }

  private scaleBooleanGrid(grid: boolean[][], resolution: number): boolean[][] {
    const baseSize = grid.length;
    const scaled = Array.from({ length: resolution }, () => Array(resolution).fill(false));
    const scale = resolution / baseSize;

    for (let by = 0; by < baseSize; by++) {
      for (let bx = 0; bx < baseSize; bx++) {
        if (!grid[by][bx]) {
          continue;
        }
        const startX = Math.floor(bx * scale);
        const endX = Math.max(startX + 1, Math.floor((bx + 1) * scale));
        const startY = Math.floor(by * scale);
        const endY = Math.max(startY + 1, Math.floor((by + 1) * scale));

        for (let y = startY; y < endY && y < resolution; y++) {
          for (let x = startX; x < endX && x < resolution; x++) {
            if (x >= 0 && y >= 0) {
              scaled[y][x] = true;
            }
          }
        }
      }
    }

    return scaled;
  }

  private seededRandom(seed: number) {
    let value = seed % 2147483647;
    if (value <= 0) {
      value += 2147483646;
    }
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }
}

