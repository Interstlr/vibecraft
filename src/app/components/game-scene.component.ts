import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GameStateService } from '../services/game-state.service';
import { MaterialService } from '../services/material.service';
import { PLAYER_CONFIG } from '../config/player.config';
import { WORLD_CONFIG } from '../config/world.config';

interface BlockInstance {
  type: string;
  instanceId: number;
}

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

  // --- Three.js Variables ---
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private renderer!: THREE.WebGLRenderer;
  public controls!: PointerLockControls; 
  
  // --- Instanced Rendering ---
  private instancedMeshes = new Map<string, THREE.InstancedMesh>();
  private readonly MAX_INSTANCES = 10000; // Reduced for safety, but efficient count mgmt makes this flexible
  private nextInstanceIndex = new Map<string, number>();
  private freeInstanceIndices = new Map<string, number[]>();

  // --- Block Data ---
  // Maps "x,y,z" string to { type, instanceId }
  private blockData = new Map<string, BlockInstance>();
  
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
  private isSwinging = false;

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
  }

  private generateWorld() {
    const size = WORLD_CONFIG.size;
    const halfSize = size / 2;

    for (let x = -halfSize; x < halfSize; x++) {
      for (let z = -halfSize; z < halfSize; z++) {
        let y = 0;
        if (Math.random() < WORLD_CONFIG.hillFrequency) y = 1;
        
        this.addBlock(x, y, z, 'grass');
        if(y > 0) this.addBlock(x, y-1, z, 'dirt');
        
        if (x > -5 && x < 5 && z > -5 && z < 5) {
          // spawn area clear
        } else if (Math.random() < WORLD_CONFIG.treeDensity) {
          this.createTree(x, y + 1, z);
        }
      }
    }
    this.createHouse(5, 1, 5);
    
    // IMPORTANT: Only update used counts once after generation
    this.instancedMeshes.forEach((mesh, type) => {
        const nextIndex = this.nextInstanceIndex.get(type) || 0;
        mesh.count = nextIndex;
        mesh.instanceMatrix.needsUpdate = true;
    });
  }

  private createTree(x: number, y: number, z: number) {
    const height = 4 + Math.floor(Math.random() * 2);
    for(let i=0; i<height; i++) {
      this.addBlock(x, y+i, z, 'wood');
    }
    const leafStart = y + height - 2;
    for(let lx = x-2; lx <= x+2; lx++) {
      for(let lz = z-2; lz <= z+2; lz++) {
        for(let ly = leafStart; ly <= leafStart + 2; ly++) {
          if (Math.abs(lx-x) + Math.abs(lz-z) + Math.abs(ly-leafStart-1) <= 3) {
             if(!this.blockData.has(`${lx},${ly},${lz}`)) {
                 this.addBlock(lx, ly, lz, 'leaves');
             }
          }
        }
      }
    }
  }

  private createHouse(startX: number, startY: number, startZ: number) {
    const width = 6, depth = 6, height = 4;
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        for(let y = 0; y < height; y++) {
          if(x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
            if(x === Math.floor(width/2) && z === 0 && y < 2) continue; 
            if(x === 0 && z === Math.floor(depth/2) && y === 1) continue; 
            if(x === width - 1 && z === Math.floor(depth/2) && y === 1) continue;
            this.addBlock(startX + x, startY + y, startZ + z, 'wood');
          }
        }
      }
    }
    for(let x = 0; x < width; x++) {
      for(let z = 0; z < depth; z++) {
        this.addBlock(startX + x, startY + height, startZ + z, 'wood');
      }
    }
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
    if (this.store.selectedSlot() === 9) { // Axe
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
        let baseSpeed = this.MINING_SPEEDS[block.type] || 1.0;
        if (this.store.selectedSlot() === 9 && (block.type === 'wood' || block.type === 'workbench')) {
           baseSpeed = baseSpeed / 5.0;
        }

        this.miningTimer += delta;
        const percentage = Math.min(100, (this.miningTimer / baseSpeed) * 100);
        this.store.miningProgress.set(percentage);

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
  }

  public lockControls() {
    this.controls.lock();
  }
}
