import { Component, HostListener, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../game/inventory/inventory.service';
import { InventorySlot } from '../game/inventory/inventory-slot';
import { BLOCKS } from '../config/blocks.config';
import { BlockIconService } from '../game/rendering/block-icon.service';
import { PlayerInteractionService } from '../game/player/player-interaction.service';

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
  playerInteraction = inject(PlayerInteractionService);
  
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

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.code === 'KeyQ') {
      this.dropOneItemHoveredOrHeld();
    }
  }

  private dropOneItemHoveredOrHeld() {
    // 1. If holding an item, drop one from held stack
    const held = this.inventoryService.heldItem();
    if (held.item) {
      const dropped = this.inventoryService.dropOneHeld();
      if (dropped) {
        this.spawnDrop(dropped);
      }
      return;
    }

    // 2. If hovering over a slot, drop one from that slot
    // We need to know which slot is hovered. 
    // We can track hovered slot index in a signal.
    const hoveredIndex = this.hoveredSlotIndex();
    if (hoveredIndex !== -1) {
      const slot = this.inventoryService.getSlot(hoveredIndex);
      if (slot.item && slot.count > 0) {
        // Logic to remove one from specific slot and return it
        // InventoryService needs a method for this or we do it manually
        const item = slot.item;
        this.inventoryService.setSlot(hoveredIndex, slot.item, slot.count - 1);
        if (slot.count - 1 === 0) {
             this.inventoryService.setSlot(hoveredIndex, null, 0);
        }
        this.spawnDrop({ item, count: 1 });
      }
    }
  }

  private spawnDrop(dropped: InventorySlot) {
     if (!dropped.item) return;
     this.playerInteraction.dropItem(dropped.item, dropped.count);
  }

  hoveredSlotIndex = signal<number>(-1);

  onSlotMouseEnter(slotIndex: number, event: MouseEvent) {
    this.hoveredSlotIndex.set(slotIndex);
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
    this.hoveredSlotIndex.set(-1);
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
    }
    
    if (dropped && dropped.item) {
       this.spawnDrop(dropped);
    }
  }
}
