import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GameStateService } from '../services/game-state.service';
import { MaterialService } from '../services/material.service';
import { WorldBuilder } from '../services/tree-generator.service';
import { WorldGeneratorService } from '../services/world-generator.service';
import { PLAYER_CONFIG } from '../config/player.config';
import { WORLD_CONFIG } from '../config/world.config';

interface BlockInstance {
  type: string;
  instanceId: number;
}

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

@Component({
  selector: 'app-game-scene',
  standalone: true,
  imports: [CommonModule],
  template: '<div #rendererContainer class="absolute top-0 left-0 w-full h-full"></div>',
})
export class GameSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer') rendererContainer!: ElementRef<HTMLDivElement>;
  
  store = inject(GameStateService);
  materials = inject(MaterialService);
  worldGenerator = inject(WorldGeneratorService);

  // --- Three.js Variables ---
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  public controls!: PointerLockControls; 
  
  // --- Instanced Rendering ---
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private readonly MAX_INSTANCES = Math.max(10000, WORLD_CONFIG.size * WORLD_CONFIG.size * 6);
  private nextInstanceIndex = new Map<string, number>();
  private freeInstanceIndices = new Map<string, number[]>();

  // --- Block Data ---
  // Maps "x,y,z" string to { type, instanceId }
  private blockData = new Map<string, BlockInstance>();
  private crackMaterials: THREE.MeshBasicMaterial[] = [];
  private crackOverlayMesh: THREE.Mesh | null = null;
  private currentCrackStage = -1;
  private crackBlockKey: string | null = null;
  private readonly CRACK_STAGE_COUNT = 5;
  private grassTickTimer = 0;
  private readonly GRASS_TICK_INTERVAL = 0.75;
  private readonly GRASS_TICK_ATTEMPTS = 40;
  private readonly GRASS_LIGHT_SCAN_HEIGHT = 6;
  
  // Movement
  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private canJump = false;
  private velocity = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private prevTime = performance.now();

  // Tool Animation
  private axeGroup!: THREE.Group;
  private handGroup!: THREE.Group;
  private isSwinging = false;

  // Sky Elements
  private sunMesh!: THREE.Mesh;

  // Interaction
  private outlineMesh!: THREE.LineSegments;
  private hitBlockPosition: THREE.Vector3 | null = null; 
  private hitBlockNormal: THREE.Vector3 | null = null; 
  
  private isMining = false;
  private miningTimer = 0;
  private animationId: number = 0;

  // Config
  private readonly MINING_SPEEDS: Record<string, number> = {
    'wood': 2.0,
    'leaves': 0.2,
    'stone': 3.0,
    'dirt': 0.5,
    'grass': 0.5,
    'workbench': 2.0
  };

  private _dummy = new THREE.Object3D();

  constructor() {}

  ngAfterViewInit() {
    this.initThree();
    this.initInstancedMeshes();
    this.generateWorld();
    this.animate();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  // --- Initialization ---

  private initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(WORLD_CONFIG.backgroundColor);
    this.scene.fog = new THREE.Fog(WORLD_CONFIG.backgroundColor, WORLD_CONFIG.fogNear, WORLD_CONFIG.fogFar);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.y = 10;
    this.scene.add(this.camera);

    // Lights
    // Increased ambient light slightly since shadows are off
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(50, 100, 50);
    // Shadows disabled to prevent artifacts
    this.scene.add(dirLight);
    this.createSun(dirLight.position.clone());

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Shadow map disabled
    this.renderer.shadowMap.enabled = false;
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new PointerLockControls(this.camera, document.body);
    
    this.controls.addEventListener('lock', () => {
      this.store.showInstructions.set(false);
      if (this.store.isMenuOpen()) {
        this.store.closeMenus();
      }
    });

    this.controls.addEventListener('unlock', () => {
      if (!this.store.isMenuOpen()) {
        this.store.showInstructions.set(true);
      }
    });

    // Highlight Box
    const outlineGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const outlineEdges = new THREE.EdgesGeometry(outlineGeo);
    this.outlineMesh = new THREE.LineSegments(outlineEdges, this.materials.getMaterial('hover') as THREE.LineBasicMaterial);
    this.outlineMesh.visible = false;
    this.scene.add(this.outlineMesh);

    this.createCrackOverlay();
    this.createToolModels();
  }

  private initInstancedMeshes() {
    const allMaterials = this.materials.getAllMaterials();
    const geometry = new THREE.BoxGeometry(WORLD_CONFIG.blockSize, WORLD_CONFIG.blockSize, WORLD_CONFIG.blockSize);

    for (const [name, material] of Object.entries(allMaterials)) {
      if (name === 'hover' || name === 'axe') continue;

      // Create mesh with max capacity
      const mesh = new THREE.InstancedMesh(geometry, material, this.MAX_INSTANCES);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      
      // Shadows disabled
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      
      mesh.frustumCulled = false; // Critical for stability
      
      // Optimization: Start with count 0 so GPU draws nothing
      mesh.count = 0;

      this.scene.add(mesh);
      
      this.instancedMeshes.set(name, mesh);
      this.nextInstanceIndex.set(name, 0);
      this.freeInstanceIndices.set(name, []);
    }
  }

  private createToolModels() {
    this.axeGroup = new THREE.Group();

    // Handle
    const handleGeo = new THREE.BoxGeometry(0.06, 0.6, 0.06);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 }); 
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0;
    this.axeGroup.add(handle);

    // Head
    const headGeo = new THREE.BoxGeometry(0.25, 0.12, 0.08);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x757575 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.25;
    head.position.x = 0.08;
    this.axeGroup.add(head);

    // Edge
    const edgeGeo = new THREE.BoxGeometry(0.05, 0.12, 0.082);
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xEEEEEE });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = 0.25;
    edge.position.x = 0.22;
    this.axeGroup.add(edge);

    this.axeGroup.position.set(0.5, -0.5, -0.8);
    this.axeGroup.rotation.set(0, -Math.PI / 4, Math.PI / 8);
    this.axeGroup.visible = false;

    this.camera.add(this.axeGroup);

    this.handGroup = new THREE.Group();
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xE0B187 });

    const armGeo = new THREE.BoxGeometry(0.18, 0.55, 0.18);
    const arm = new THREE.Mesh(armGeo, skinMat);
    arm.position.set(0, -0.05, 0.01);
    this.handGroup.add(arm);

    const palmGeo = new THREE.BoxGeometry(0.22, 0.18, 0.2);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    palm.position.set(0.01, -0.37, 0.08);
    this.handGroup.add(palm);

    const thumbGeo = new THREE.BoxGeometry(0.06, 0.16, 0.08);
    const thumb = new THREE.Mesh(thumbGeo, skinMat);
    thumb.position.set(0.12, -0.33, 0.02);
    thumb.rotation.z = -Math.PI / 10;
    this.handGroup.add(thumb);

    this.handGroup.position.set(0.72, -0.65, -0.9);
    this.handGroup.rotation.set(-Math.PI / 5, Math.PI / 11, Math.PI / 18);
    this.handGroup.visible = false;

    this.camera.add(this.handGroup);
  }

  private createCrackOverlay() {
    const textures = this.createCrackTextures(this.CRACK_STAGE_COUNT);
    if (!textures.length || !this.renderer) {
      return;
    }

    const anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.crackMaterials = textures.map((texture) => {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.anisotropy = anisotropy;
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
    this.scene.add(this.crackOverlayMesh);
  }

  private createCrackTextures(count: number): THREE.Texture[] {
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
        ctx.imageSmoothingEnabled = false;
      }

      const stageIndex = stage - 1;
      const opacity = THREE.MathUtils.lerp(0.35, 0.85, stageIndex / Math.max(1, count - 1));
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      const mask = this.getCrackMaskForStage(stageIndex, gridResolution);
      ctx.fillStyle = `rgba(30, 30, 30, ${opacity})`;

      for (let y = 0; y < gridResolution; y++) {
        for (let x = 0; x < gridResolution; x++) {
          if (!mask[y][x]) continue;
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

  private showCrackOverlay(position: THREE.Vector3, progressRatio: number) {
    const key = `${position.x},${position.y},${position.z}`;
    this.crackBlockKey = key;

    if (!this.crackOverlayMesh || this.crackMaterials.length === 0) {
      return;
    }

    const clamped = THREE.MathUtils.clamp(progressRatio, 0, 0.9999);
    const stage = Math.min(this.CRACK_STAGE_COUNT - 1, Math.floor(clamped * this.CRACK_STAGE_COUNT));

    if (stage !== this.currentCrackStage) {
      this.crackOverlayMesh.material = this.crackMaterials[stage];
      this.currentCrackStage = stage;
    }

    this.crackOverlayMesh.visible = true;
    this.crackOverlayMesh.position.set(position.x, position.y, position.z);
  }

  private hideCrackOverlay() {
    this.currentCrackStage = -1;
    this.crackBlockKey = null;
    if (this.crackOverlayMesh) {
      this.crackOverlayMesh.visible = false;
    }
  }

  // --- Grass Simulation ---

  private handleGrassSimulation(delta: number) {
    this.grassTickTimer += delta;
    if (this.grassTickTimer < this.GRASS_TICK_INTERVAL) return;
    this.grassTickTimer = 0;
    this.performGrassTicks();
  }

  private performGrassTicks() {
    if (this.blockData.size === 0) return;
    const entries = Array.from(this.blockData.entries());
    const attempts = Math.min(this.GRASS_TICK_ATTEMPTS, entries.length);

    for (let i = 0; i < attempts; i++) {
      const [key, block] = entries[Math.floor(Math.random() * entries.length)];
      const [x, y, z] = key.split(',').map(Number);

      if (block.type === 'grass') {
        this.updateGrassBlock(x, y, z);
        this.trySpreadGrass(x, y, z);
      } else if (block.type === 'dirt') {
        this.tryReviveDirt(x, y, z);
      }
    }
  }

  private updateGrassBlock(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) {
      this.replaceBlock(x, y, z, 'dirt');
    }
  }

  private trySpreadGrass(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) return;
    if (Math.random() > 0.5) return;

    const targetX = x + THREE.MathUtils.randInt(-1, 1);
    const targetY = y + THREE.MathUtils.randInt(-1, 1);
    const targetZ = z + THREE.MathUtils.randInt(-1, 1);

    if (targetX === x && targetY === y && targetZ === z) return;

    const candidate = this.blockData.get(`${targetX},${targetY},${targetZ}`);
    if (candidate?.type !== 'dirt') return;
    if (!this.isAir(targetX, targetY + 1, targetZ)) return;
    if (!this.hasSkyAccess(targetX, targetY, targetZ)) return;

    this.replaceBlock(targetX, targetY, targetZ, 'grass');
  }

  private tryReviveDirt(x: number, y: number, z: number) {
    if (!this.isAir(x, y + 1, z)) return;
    if (!this.hasSkyAccess(x, y, z)) return;
    if (!this.hasAdjacentGrass(x, y, z)) return;
    if (Math.random() > 0.25) return;

    this.replaceBlock(x, y, z, 'grass');
  }

  private hasAdjacentGrass(x: number, y: number, z: number): boolean {
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let oz = -1; oz <= 1; oz++) {
          if (ox === 0 && oy === 0 && oz === 0) continue;
          const neighbor = this.blockData.get(`${x + ox},${y + oy},${z + oz}`);
          if (neighbor?.type === 'grass') {
            return true;
          }
        }
      }
    }
    return false;
  }

  private hasSkyAccess(x: number, y: number, z: number): boolean {
    for (let dy = 1; dy <= this.GRASS_LIGHT_SCAN_HEIGHT; dy++) {
      if (this.blockData.has(`${x},${y + dy},${z}`)) {
        return false;
      }
    }
    return true;
  }

  private isAir(x: number, y: number, z: number): boolean {
    return !this.blockData.has(`${x},${y},${z}`);
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
        if (!pattern[y][x]) continue;
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
        if (!grid[by][bx]) continue;
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
    if (value <= 0) value += 2147483646;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  private createSun(direction: THREE.Vector3) {
    const normalizedDirection = direction.lengthSq() > 0 ? direction.normalize() : new THREE.Vector3(0.5, 1, 0.5).normalize();
    const sunDistance = 120;
    const sunGeometry = new THREE.PlaneGeometry(32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff4c1,
      transparent: true,
      opacity: 0.98,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      fog: false
    });

    this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    this.sunMesh.position.copy(normalizedDirection.multiplyScalar(sunDistance));
    this.scene.add(this.sunMesh);
  }

  private getInventoryCountForSlot(slot: number): number {
    switch (slot) {
      case 1: return this.store.grassCount();
      case 2: return this.store.dirtCount();
      case 3: return this.store.stoneCount();
      case 4: return this.store.woodCount();
      case 5: return this.store.leavesCount();
      case 8: return this.store.hasWorkbench();
      case 9: return this.store.hasAxe();
      default: return 0;
    }
  }

  private generateWorld() {
    // Create a WorldBuilder context for external generators
    const worldBuilder: WorldBuilder = {
      addBlock: (x, y, z, type) => this.addBlock(x, y, z, type),
      hasBlock: (x, y, z) => this.blockData.has(`${x},${y},${z}`)
    };

    this.worldGenerator.generate(worldBuilder);
    
    // IMPORTANT: Only update used counts once after generation
    this.instancedMeshes.forEach((mesh, type) => {
        const nextIndex = this.nextInstanceIndex.get(type) || 0;
        mesh.count = nextIndex;
        mesh.instanceMatrix.needsUpdate = true;
    });
  }

  // --- Block Logic (Instanced) ---

  private addBlock(x: number, y: number, z: number, type: string) {
    const key = `${x},${y},${z}`;
    if (this.blockData.has(key)) return; 

    const mesh = this.instancedMeshes.get(type);
    if (!mesh) return;

    let instanceId: number;
    const freeIndices = this.freeInstanceIndices.get(type)!;
    const nextIndex = this.nextInstanceIndex.get(type)!;

    if (freeIndices.length > 0) {
      instanceId = freeIndices.pop()!;
    } else {
      instanceId = nextIndex;
      if (instanceId >= this.MAX_INSTANCES) return;
      
      this.nextInstanceIndex.set(type, instanceId + 1);
      // Expand mesh count to include new block
      if (mesh.count <= instanceId) {
          mesh.count = instanceId + 1;
      }
    }

    this._dummy.position.set(x, y, z);
    this._dummy.scale.set(1, 1, 1);
    this._dummy.updateMatrix();
    mesh.setMatrixAt(instanceId, this._dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    this.blockData.set(key, { type, instanceId });
    this.store.blockCount.set(this.blockData.size);
  }

  private removeBlock(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    const block = this.blockData.get(key);
    if (!block) return;

    const mesh = this.instancedMeshes.get(block.type);
    if (mesh) {
      // We can't easily shrink mesh.count because we might be removing from the middle.
      // Instead, scale to 0 (hidden) and reuse the slot later.
      this._dummy.position.set(0, 0, 0);
      this._dummy.scale.set(0, 0, 0);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(block.instanceId, this._dummy.matrix);
      mesh.instanceMatrix.needsUpdate = true;

      this.freeInstanceIndices.get(block.type)?.push(block.instanceId);
    }

    this.blockData.delete(key);
    this.store.blockCount.set(this.blockData.size);
  }

  private replaceBlock(x: number, y: number, z: number, newType: string) {
    const existing = this.blockData.get(`${x},${y},${z}`);
    if (!existing || existing.type === newType) return;
    this.removeBlock(x, y, z);
    this.addBlock(x, y, z, newType);
  }

  // --- Game Loop ---

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const time = performance.now();
    const delta = (time - this.prevTime) / 1000;
    this.prevTime = time;

    if (Math.random() > 0.95) this.store.fps.set(Math.round(1/delta));

    if (this.controls.isLocked) {
      this.handlePhysics(delta);
      this.performRaycast(); // DDA Raycaster (Fast)
      this.handleInteraction(delta);
      this.handleAnimations(time, delta);
    }

    this.handleGrassSimulation(delta);

    if (this.sunMesh) {
      this.sunMesh.lookAt(this.camera.position);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private handlePhysics(delta: number) {
    // Damping
    this.velocity.x -= this.velocity.x * PLAYER_CONFIG.drag * delta;
    this.velocity.z -= this.velocity.z * PLAYER_CONFIG.drag * delta;
    this.velocity.y -= PLAYER_CONFIG.gravity * delta; 

    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
    this.direction.normalize();

    if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * PLAYER_CONFIG.moveSpeed * delta;
    if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * PLAYER_CONFIG.moveSpeed * delta;

    const cam = this.camera;
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    right.setFromMatrixColumn(cam.matrix, 0);
    forward.setFromMatrixColumn(cam.matrix, 0);
    forward.crossVectors(this.camera.up, forward).normalize();
    
    const dx = (-this.velocity.x * delta) * right.x + (-this.velocity.z * delta) * forward.x;
    const dz = (-this.velocity.x * delta) * right.z + (-this.velocity.z * delta) * forward.z;

    cam.position.x += dx;
    if (this.getCollidingBlock(cam.position)) { cam.position.x -= dx; this.velocity.x = 0; }

    cam.position.z += dz;
    if (this.getCollidingBlock(cam.position)) { cam.position.z -= dz; this.velocity.z = 0; }

    cam.position.y += (this.velocity.y * delta);
    
    const hitBlock = this.getCollidingBlock(cam.position);
    if (hitBlock) {
      if(this.velocity.y < 0) {
        // Landed
        this.velocity.y = 0;
        this.canJump = true;
        cam.position.y = hitBlock.y + 0.5 + PLAYER_CONFIG.eyeHeight;
      } else {
        // Hit head
        this.velocity.y = 0;
        cam.position.y -= (this.velocity.y * delta);
      }
    }

    if (cam.position.y < PLAYER_CONFIG.eyeHeight) { 
      this.velocity.y = 0;
      cam.position.y = PLAYER_CONFIG.eyeHeight;
      this.canJump = true;
    }
  }

  private handleAnimations(time: number, delta: number) {
    const slot = this.store.selectedSlot();
    const hasAxeEquipped = slot === 9 && this.store.hasAxe() > 0;
    const slotItemCount = this.getInventoryCountForSlot(slot);
    const shouldShowHand = !hasAxeEquipped && slotItemCount === 0;

    if (hasAxeEquipped) {
      this.axeGroup.visible = true;
      if (this.isSwinging) {
        const swingSpeed = 8;
        this.axeGroup.rotation.x = Math.sin(time/1000 * swingSpeed) * 0.8; 
        this.axeGroup.rotation.z = Math.PI/8 + Math.sin(time/1000 * swingSpeed) * 0.2;
        this.axeGroup.position.y = -0.5 + Math.sin(time/1000 * swingSpeed) * 0.1;
      } else {
        this.axeGroup.rotation.x = THREE.MathUtils.lerp(this.axeGroup.rotation.x, 0, 10 * delta);
        this.axeGroup.rotation.z = Math.PI/8;
        this.axeGroup.position.y = -0.5;
      }
    } else {
      this.axeGroup.visible = false;
    }

    if (shouldShowHand) {
      this.handGroup.visible = true;
      const swingSpeed = 9;
      const baseRotX = -0.4;
      const baseRotZ = Math.PI / 10;
      const basePosY = -0.65;
      if (this.isSwinging) {
        const swing = Math.sin(time / 1000 * swingSpeed);
        this.handGroup.rotation.x = baseRotX + swing * 0.35;
        this.handGroup.rotation.z = baseRotZ + swing * 0.18;
        this.handGroup.position.y = basePosY + swing * 0.04;
      } else {
        const idleBob = Math.sin(time / 1400) * 0.008;
        this.handGroup.rotation.x = THREE.MathUtils.lerp(this.handGroup.rotation.x, baseRotX, 6 * delta);
        this.handGroup.rotation.z = THREE.MathUtils.lerp(this.handGroup.rotation.z, baseRotZ, 6 * delta);
        this.handGroup.position.y = THREE.MathUtils.lerp(this.handGroup.position.y, basePosY + idleBob, 6 * delta);
      }
    } else {
      this.handGroup.visible = false;
    }
  }

  // --- Voxel Raycasting (DDA Algorithm) ---
  private performRaycast() {
    this.hitBlockPosition = null;
    this.hitBlockNormal = null;
    this.outlineMesh.visible = false;

    const start = this.camera.position.clone();
    start.x += 0.5;
    start.y += 0.5;
    start.z += 0.5;

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    let x = Math.floor(start.x);
    let y = Math.floor(start.y);
    let z = Math.floor(start.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = stepX > 0 ? (Math.floor(start.x) + 1 - start.x) * tDeltaX : (start.x - Math.floor(start.x)) * tDeltaX;
    let tMaxY = stepY > 0 ? (Math.floor(start.y) + 1 - start.y) * tDeltaY : (start.y - Math.floor(start.y)) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (Math.floor(start.z) + 1 - start.z) * tDeltaZ : (start.z - Math.floor(start.z)) * tDeltaZ;

    let reachedLimit = false;
    let hitNormal = new THREE.Vector3();
    const maxReach = PLAYER_CONFIG.reachDistance;
    
    const maxSteps = maxReach * 3; 

    for (let i = 0; i < maxSteps; i++) {
      if (this.blockData.has(`${x},${y},${z}`)) {
        this.hitBlockPosition = new THREE.Vector3(x, y, z);
        this.hitBlockNormal = hitNormal;
        this.outlineMesh.position.set(x, y, z);
        this.outlineMesh.visible = true;
        return;
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          tMaxX += tDeltaX;
          hitNormal.set(-stepX, 0, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          hitNormal.set(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          tMaxY += tDeltaY;
          hitNormal.set(0, -stepY, 0);
        } else {
          z += stepZ;
          tMaxZ += tDeltaZ;
          hitNormal.set(0, 0, -stepZ);
        }
      }

      const distSq = (x + 0.5 - start.x)**2 + (y + 0.5 - start.y)**2 + (z + 0.5 - start.z)**2;
      if (distSq > maxReach * maxReach) {
        reachedLimit = true;
        break;
      }
    }
  }

  private handleInteraction(delta: number) {
    if (this.isMining && this.hitBlockPosition) {
      const key = `${this.hitBlockPosition.x},${this.hitBlockPosition.y},${this.hitBlockPosition.z}`;
      const block = this.blockData.get(key);
      
      if (block) {
        if (this.crackBlockKey && this.crackBlockKey !== key) {
          this.miningTimer = 0;
          this.store.miningProgress.set(0);
          this.currentCrackStage = -1;
        }

        let baseSpeed = this.MINING_SPEEDS[block.type] || 1.0;
        if (this.store.selectedSlot() === 9 && (block.type === 'wood' || block.type === 'workbench')) {
           baseSpeed = baseSpeed / 5.0;
        }

        this.miningTimer += delta;
        const miningRatio = Math.min(1, this.miningTimer / baseSpeed);
        const percentage = Math.min(100, miningRatio * 100);
        this.store.miningProgress.set(percentage);
        this.showCrackOverlay(this.hitBlockPosition, miningRatio);

        if (this.miningTimer >= baseSpeed) {
           // Add to inventory
           this.store.addToInventory(block.type, 1);
           
           this.removeBlock(this.hitBlockPosition.x, this.hitBlockPosition.y, this.hitBlockPosition.z);
           this.stopMining();
        }
      } else {
        this.stopMining();
      }
    } else if (this.isMining && !this.hitBlockPosition) {
      this.stopMining();
    }
  }

  private getCollidingBlock(pos: THREE.Vector3): { y: number } | null {
    const r = PLAYER_CONFIG.collisionRadius;
    const minX = Math.floor(pos.x - r - 0.5);
    const maxX = Math.ceil(pos.x + r + 0.5);
    const minZ = Math.floor(pos.z - r - 0.5);
    const maxZ = Math.ceil(pos.z + r + 0.5);
    const minY = Math.floor(pos.y - PLAYER_CONFIG.eyeHeight);
    const maxY = Math.floor(pos.y + 0.1);

    for(let x = minX; x <= maxX; x++) {
      for(let z = minZ; z <= maxZ; z++) {
        for(let y = minY; y <= maxY; y++) {
          if(this.blockData.has(`${x},${y},${z}`)) {
            if (Math.abs(pos.x - x) < (0.5 + r) &&
                Math.abs(pos.z - z) < (0.5 + r) &&
                (pos.y - PLAYER_CONFIG.eyeHeight < y + 0.5 && pos.y + 0.2 > y - 0.5)) {
              return { y: y };
            }
          }
        }
      }
    }
    return null;
  }

  // --- Input Handling ---

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (this.controls && this.controls.isLocked) {
      switch (event.code) {
        case 'ArrowUp': case 'KeyW': this.moveForward = true; break;
        case 'ArrowLeft': case 'KeyA': this.moveLeft = true; break;
        case 'ArrowDown': case 'KeyS': this.moveBackward = true; break;
        case 'ArrowRight': case 'KeyD': this.moveRight = true; break;
        case 'Space': if (this.canJump) this.velocity.y += PLAYER_CONFIG.jumpForce; this.canJump = false; break;
        case 'KeyE': this.store.openCraftingMenu(); this.controls.unlock(); break;
        case 'Digit1': this.store.selectedSlot.set(1); break;
        case 'Digit2': this.store.selectedSlot.set(2); break;
        case 'Digit3': this.store.selectedSlot.set(3); break;
        case 'Digit4': this.store.selectedSlot.set(4); break;
        case 'Digit5': this.store.selectedSlot.set(5); break; // Leaves
        case 'Digit8': if (this.store.hasWorkbench() > 0) this.store.selectedSlot.set(8); break;
        case 'Digit9': if (this.store.hasAxe() > 0) this.store.selectedSlot.set(9); break;
      }
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp': case 'KeyW': this.moveForward = false; break;
      case 'ArrowLeft': case 'KeyA': this.moveLeft = false; break;
      case 'ArrowDown': case 'KeyS': this.moveBackward = false; break;
      case 'ArrowRight': case 'KeyD': this.moveRight = false; break;
    }
  }

  @HostListener('window:mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (!this.controls.isLocked) return;
    if (event.button === 0) this.isSwinging = true;

    if (this.hitBlockPosition) {
      const key = `${this.hitBlockPosition.x},${this.hitBlockPosition.y},${this.hitBlockPosition.z}`;
      const block = this.blockData.get(key);

      if (event.button === 0) { // Mine
        this.isMining = true;
        this.miningTimer = 0;
        this.showCrackOverlay(this.hitBlockPosition, 0);
      } else if (event.button === 2) { // Build/Interact
        if (block?.type === 'workbench') {
           this.store.openWorkbenchMenu();
           this.controls.unlock();
           return;
        }

        const type = this.store.selectedBlockName();
        if (type === 'axe') return;

        if (this.hitBlockNormal) {
          const pos = this.hitBlockPosition.clone().add(this.hitBlockNormal);
          const playerPos = this.camera.position.clone();
          playerPos.y -= PLAYER_CONFIG.eyeHeight; 
          
          if(pos.distanceTo(playerPos) > 1.2) {
             if (type === 'workbench') {
               if (this.store.hasWorkbench() > 0) {
                 this.addBlock(pos.x, pos.y, pos.z, 'workbench');
                 this.store.removeFromInventory('workbench', 1);
                 if (this.store.hasWorkbench() === 0) this.store.selectedSlot.set(1);
               }
             } else {
               // Check if player has block
               if (this.store.hasItem(type)) {
                  this.store.removeFromInventory(type, 1);
                  this.addBlock(pos.x, pos.y, pos.z, type);
               }
             }
          }
        }
      }
    }
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    this.stopMining();
    this.isSwinging = false;
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (this.camera && this.renderer) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  private stopMining() {
    this.isMining = false;
    this.miningTimer = 0;
    this.store.miningProgress.set(0);
    this.hideCrackOverlay();
  }

  public lockControls() {
    this.controls.lock();
  }
}
