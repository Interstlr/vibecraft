import { Component, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../game/inventory/inventory.service';
import { InventorySlot } from '../game/inventory/inventory-slot';
import { BLOCKS } from '../config/blocks.config';

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
  
  mouseX = signal(0);
  mouseY = signal(0);

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
    const def = this.blocks[item];
    
    // Block definitions
    if (def?.faces?.side?.texture) return def.faces.side.texture;
    if (def?.faces?.top?.texture) return def.faces.top.texture;
    if (def?.texture) return def.texture;

    return '';
  }
  
  getSlotColor(item: string | null): string {
     if (!item) return 'transparent';
     
     // Check manual color map first for items
     if (ITEM_COLORS[item]) return ITEM_COLORS[item];

     const def = this.blocks[item];
     if (def?.procedural?.color1) return def.procedural.color1;
     
     return '#FF00FF'; // Missing texture/color debug
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
