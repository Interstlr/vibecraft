import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BlockPlacerService } from '../world/block-placer.service';
import { GameStateService } from '../../services/game-state.service';
import { InventoryService } from '../inventory/inventory.service';
import { PlayerRaycasterService } from './player-raycaster.service';
import { CrackOverlayService } from '../rendering/crack-overlay.service';
import { ToolRendererService } from '../rendering/tool-renderer.service';
import { SceneManagerService } from '../core/scene-manager.service';
import { InputManagerService } from '../core/input-manager.service';
import { ItemDropSystemService } from '../systems/item-drop-system.service';
import { ChickenSystemService } from '../systems/chicken-system.service';
import { BLOCKS } from '../config/blocks.config';
import { PLAYER_CONFIG } from '../../config/player.config';

@Injectable({
  providedIn: 'root',
})
export class PlayerInteractionService {
  private isMining = false; // Keeps track of if we are potentially mining (action held)
  private miningTimer = 0;
  private raycasterThree = new THREE.Raycaster();

  constructor(
    private blockPlacer: BlockPlacerService,
    private store: GameStateService,
    private inventoryService: InventoryService,
    private raycaster: PlayerRaycasterService,
    private crackOverlay: CrackOverlayService,
    private toolRenderer: ToolRendererService,
    private sceneManager: SceneManagerService,
    private input: InputManagerService,
    private itemDropSystem: ItemDropSystemService,
    private chickenSystem: ChickenSystemService,
  ) {}

  handlePrimaryActionDown() {
    this.isMining = true;
    this.miningTimer = 0;
    this.toolRenderer.setSwinging(true);

    // Check for mob hit first
    if (this.checkMobHit()) {
        // If hit mob, don't mine block
        // But keep isMining true in case we want to swing at mobs continuously or transition to block
        // For now, similar to original logic, if we hit a mob, we don't start block mining this frame.
        return;
    }

    const hitPos = this.raycaster.getHitBlockPosition();
    if (hitPos) {
      const key = this.getKey(hitPos.x, hitPos.y, hitPos.z);
      this.crackOverlay.show(key, hitPos, 0);
    }
  }

  handlePrimaryActionUp() {
    this.isMining = false; // Only stop when released
    this.toolRenderer.setSwinging(false);
    this.miningTimer = 0;
    this.crackOverlay.hide();
  }

  handleSecondaryAction() {
    const hitPos = this.raycaster.getHitBlockPosition();
    if (!hitPos) {
      return;
    }

    const block = this.blockPlacer.getBlock(hitPos.x, hitPos.y, hitPos.z);
    if (block?.type === 'workbench') {
      this.store.openInventoryMenu();
      this.input.unlockPointer();
      return;
    }

    const selected = this.inventoryService.selectedItem();
    const type = selected.item;

    if (!type || type === 'axe') {
      return;
    }

    const normal = this.raycaster.getHitBlockNormal();
    if (!normal) {
      return;
    }

    const target = hitPos.clone().add(normal);
    
    // Check collision with player
    const playerPos = this.sceneManager.getCamera().position;
    const playerFeetY = playerPos.y - PLAYER_CONFIG.eyeHeight;
    const playerRadius = PLAYER_CONFIG.collisionRadius; 
    const playerHeight = 1.7;

    const blockMinX = target.x - 0.5;
    const blockMaxX = target.x + 0.5;
    const blockMinY = target.y - 0.5;
    const blockMaxY = target.y + 0.5;
    const blockMinZ = target.z - 0.5;
    const blockMaxZ = target.z + 0.5;

    const playerMinX = playerPos.x - playerRadius;
    const playerMaxX = playerPos.x + playerRadius;
    const playerMinY = playerFeetY;
    const playerMaxY = playerFeetY + playerHeight;
    const playerMinZ = playerPos.z - playerRadius;
    const playerMaxZ = playerPos.z + playerRadius;

    const intersects = (
        playerMinX < blockMaxX && playerMaxX > blockMinX &&
        playerMinY < blockMaxY && playerMaxY > blockMinY &&
        playerMinZ < blockMaxZ && playerMaxZ > blockMinZ
    );

    if (intersects) {
      return;
    }

    const tx = Math.round(target.x);
    const ty = Math.round(target.y);
    const tz = Math.round(target.z);

    if (this.blockPlacer.addBlock(tx, ty, tz, type)) {
        this.inventoryService.removeOneFromSelected();
    }
  }

  update(delta: number) {
    if (!this.isMining) {
      return;
    }

    const hitPos = this.raycaster.getHitBlockPosition();
    
    // If we are looking at nothing, hide overlay but keep isMining true
    if (!hitPos) {
      this.miningTimer = 0;
      this.crackOverlay.hide();
      return;
    }

    const key = this.getKey(hitPos.x, hitPos.y, hitPos.z);
    const block = this.blockPlacer.getBlock(hitPos.x, hitPos.y, hitPos.z);
    
    // If block vanished (or air), hide overlay
    if (!block) {
      this.miningTimer = 0;
      this.crackOverlay.hide();
      return;
    }

    const activeKey = this.crackOverlay.getActiveBlockKey();
    // If we switched blocks, reset timer
    if (activeKey && activeKey !== key) {
      this.miningTimer = 0;
    }

    const blockDef = BLOCKS[block.type];
    let baseSpeed = blockDef?.hardness ?? 1.0;
    
    // Unbreakable blocks
    if (baseSpeed < 0) {
        this.miningTimer = 0;
        this.crackOverlay.hide();
        return;
    }

    const selected = this.inventoryService.selectedItem();
    const toolType = selected.item;

    // Check tool effectiveness
    const isAxe = toolType === 'axe' || toolType === 'wooden_axe' || toolType === 'stone_axe';
    const isPickaxe = toolType === 'wooden_pickaxe' || toolType === 'stone_pickaxe';
    const isShovel = toolType === 'wooden_shovel' || toolType === 'stone_shovel';
    
    const isWoodOrPlank = block.type === 'wood' || block.type === 'oak_planks' || block.type === 'workbench';
    const isStone = block.type === 'stone';
    const isDirtOrGrass = block.type === 'dirt' || block.type === 'grass';

    // Tool effectiveness multipliers
    if (isAxe && isWoodOrPlank) {
      const tier = toolType === 'stone_axe' ? 7.0 : 5.0; // Stone is faster
      baseSpeed /= tier;
    } else if (isPickaxe && isStone) {
      const tier = toolType === 'stone_pickaxe' ? 5.0 : 2.5; // Stone pickaxe is more effective
      baseSpeed /= tier;
    } else if (isShovel && isDirtOrGrass) {
      const tier = toolType === 'stone_shovel' ? 6.0 : 3.0; // Stone shovel is faster
      baseSpeed /= tier;
    }

    this.miningTimer += delta;
    const miningRatio = Math.min(1, this.miningTimer / baseSpeed);
    this.crackOverlay.show(key, hitPos, miningRatio);

    if (this.miningTimer >= baseSpeed) {
      if (block.type === 'wood') {
        this.chopTreeColumn(hitPos.x, hitPos.y, hitPos.z);
      } else {
        this.spawnBlockDrop(hitPos.x, hitPos.y, hitPos.z, block.type);
        this.blockPlacer.removeBlock(hitPos.x, hitPos.y, hitPos.z);
      }
      
      // Reset for next block
      this.miningTimer = 0;
      this.crackOverlay.hide(); 
      // Do NOT set isMining = false, allowing continuous mining
    }
  }

  private checkMobHit(): boolean {
      const chickens = this.chickenSystem.getChickens();
      const camera = this.sceneManager.getCamera();
      const origin = camera.position.clone();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      
      const maxDist = 4.0;
      let closestDist = maxDist;
      let hitId: string | null = null;
      
      for (const chicken of chickens) {
          const center = chicken.position.clone().add(new THREE.Vector3(0, 0.35, 0));
          const radius = 0.4;
          
          const m = origin.clone().sub(center);
          const b = m.dot(dir);
          const c = m.dot(m) - radius * radius;
          
          if (c > 0 && b > 0) continue;
          
          const discr = b * b - c;
          if (discr < 0) continue;
          
          let t = -b - Math.sqrt(discr);
          if (t < 0) t = -b + Math.sqrt(discr);
          
          if (t > 0 && t < closestDist) {
              closestDist = t;
              hitId = chicken.id;
          }
      }
      
      if (hitId) {
          this.chickenSystem.damageChicken(hitId);
          return true;
      }
      
      return false;
  }

  private chopTreeColumn(x: number, y: number, z: number) {
    const ix = Math.round(x);
    const iz = Math.round(z);
    let currentY = Math.round(y);

    while (true) {
      const block = this.blockPlacer.getBlock(ix, currentY, iz);
      if (!block || block.type !== 'wood') {
        break;
      }
      this.spawnBlockDrop(ix, currentY, iz, 'wood');
      this.blockPlacer.removeBlock(ix, currentY, iz);
      currentY++;
    }
  }

  private spawnBlockDrop(x: number, y: number, z: number, type: string) {
    const blockDef = BLOCKS[type];
    const dropItem = blockDef?.drops ?? type;
    const dropCount = 1;

    for (let i = 0; i < dropCount; i++) {
      this.itemDropSystem.spawnDrop(dropItem, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
    }
  }

  private stopMining() {
      // Removed in favor of direct property access in handlePrimaryActionUp
      // to clarify intent of not stopping continuously.
  }

  private getKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }
}
