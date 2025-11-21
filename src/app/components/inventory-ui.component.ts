import { Component, HostListener, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../game/inventory/inventory.service';
import { InventorySlot } from '../game/inventory/inventory-slot';
import { BLOCKS } from '../config/blocks.config';
import { BlockIconService } from '../game/rendering/block-icon.service';

const ITEM_COLORS: Record<string, string> = {
  'plank': '#C19A6B',
  'stick': '#8D6E63',
  'torch': '#FFD700',
  'wooden_pickaxe': '#8D6E63',
  'wooden_axe': '#8D6E63',
  'coal': '#212121',
  'workbench': '#D2691E',
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
     // This method is less relevant now that we render icons, 
     // but might still be used as fallback background if icon generation fails or is loading?
     // Actually, BlockIconService returns data URL, so this color might be behind the image or unused if image covers it.
     if (!item) return 'transparent';
     return 'transparent'; 
  }

  getItemDisplayName(item: string | null): string {
    if (!item) return '';
    
    // Format item ID to display name
    // "wooden_axe" -> "Wooden Axe"
    // "oak_planks" -> "Oak Planks"
    // "stone_pickaxe" -> "Stone Pickaxe"
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
}
