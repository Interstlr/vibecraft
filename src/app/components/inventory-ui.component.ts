import { Component, HostListener, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../game/inventory/inventory.service';
import { InventorySlot } from '../game/inventory/inventory-slot';
import { BLOCKS } from '../config/blocks.config';
import { BlockIconService } from '../game/rendering/block-icon.service';
import { ItemDropSystemService } from '../game/systems/item-drop-system.service';
import { SceneManagerService } from '../game/core/scene-manager.service';
import * as THREE from 'three';

const ITEM_COLORS: Record<string, string> = {
  'plank': '#C19A6B',
  'stick': '#8D6E63',
  'torch': '#FFD700',
  'wooden_pickaxe': '#8D6E63',
  'wooden_axe': '#8D6E63',
  'coal': '#212121',
  'workbench': '#D2691E',
  'stone': '#7d7d7d',
  'grass': '#567d46',
  'dirt': '#594230',
  'cobble': '#606060',
};

@Component({
  selector: 'app-inventory-ui',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inventory-ui.component.html',
  styleUrls: ['./inventory-ui.component.scss']
})
export class InventoryUiComponent {
  blocks = BLOCKS;
  blockIconService = inject(BlockIconService);
  itemDropSystem = inject(ItemDropSystemService);
  sceneManager = inject(SceneManagerService);
  
  mouseX = signal(0);
  mouseY = signal(0);
  
  // Tooltip state
  tooltipVisible = signal(false);
  tooltipItem = signal<string | null>(null);
  tooltipX = signal(0);
  tooltipY = signal(0);

  craftingIndices = computed(() => {
    if (this.inventoryService.craftingGridSize() === 2) {
      return [37, 38, 39, 40];
    } else {
      // 3x3 grid indices
      return [37, 38, 39, 40, 41, 42, 43, 44, 45];
    }
  });

  resultSlotIndex = computed(() => this.inventoryService.RESULT_SLOT);

  constructor(public inventoryService: InventoryService) {}

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    this.mouseX.set(e.clientX);
    this.mouseY.set(e.clientY);
  }

  getSlotImage(item: string | null): string {
    if (!item) return '';
    // Use block icon service for all items that are blocks or have mesh representation
    return this.blockIconService.getIcon(item);
  }
  
  getSlotColor(item: string | null): string {
     if (!item) return 'transparent';
     return ITEM_COLORS[item] || '#FFFFFF'; 
  }

  getItemDisplayName(item: string | null): string {
    if (!item) return '';
    
    // Format item ID to display name
    return item
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  onSlotMouseEnter(slotIndex: number, event: MouseEvent) {
    const slot = this.inventoryService.getSlot(slotIndex);
    if (slot.item) {
      this.tooltipItem.set(slot.item);
      this.tooltipX.set(event.clientX);
      this.tooltipY.set(event.clientY);
      this.tooltipVisible.set(true);
    }
  }

  onSlotMouseMove(event: MouseEvent) {
    if (this.tooltipVisible()) {
      this.tooltipX.set(event.clientX);
      this.tooltipY.set(event.clientY);
    }
  }

  onSlotMouseLeave() {
    this.tooltipVisible.set(false);
    this.tooltipItem.set(null);
  }

  onSlotClick(index: number, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    let button: 'left' | 'right' | 'middle' | 'shift-left' = 'left';
    if (event.shiftKey && event.button === 0) button = 'shift-left';
    else if (event.button === 2) button = 'right';
    else if (event.button === 1) button = 'middle';
    
    this.inventoryService.handleSlotClick(index, button);
  }
  
  toggleGridSize() {
    this.inventoryService.toggleCraftingSize();
  }

  onContextMenu(event: Event) {
      event.preventDefault();
  }

  onBackdropClick(event: MouseEvent) {
    const held = this.inventoryService.heldItem();
    if (!held.item) return;
    
    let dropped: InventorySlot | null = null;

    if (event.button === 0) { // Left Click -> Drop Stack
       dropped = this.inventoryService.dropAllHeld();
    } else if (event.button === 2) { // Right Click -> Drop One
       dropped = this.inventoryService.dropOneHeld();
    }
    
    if (dropped && dropped.item) {
       const camera = this.sceneManager.getCamera();
       
       const dir = new THREE.Vector3();
       camera.getWorldDirection(dir);
       
       // Start closer to the player (hand position)
       const spawnPos = camera.position.clone().add(dir.clone().multiplyScalar(0.5));
       
       // Velocity: reduce force to ensure it lands nearby (approx 2 blocks)
       // 4 m/s forward + small arc up (3.5)
       const velocity = dir.clone().multiplyScalar(4).add(new THREE.Vector3(0, 3.5, 0));
       
       // Add slight randomness to feel natural
       velocity.x += (Math.random() - 0.5) * 0.5;
       velocity.z += (Math.random() - 0.5) * 0.5;
       
       this.itemDropSystem.spawnDrop(dropped.item, spawnPos, dropped.count, velocity);
    }
  }
}
