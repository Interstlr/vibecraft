import { Injectable } from '@angular/core';
import { InventoryService } from './inventory.service';
import { ITEMS_CONFIG } from '../config/items.config';

@Injectable({
  providedIn: 'root',
})
export class InventoryStackService {
  constructor(private inventoryService: InventoryService) {}

  addItem(itemId: string, quantity: number = 1): void {
    const slots = this.inventoryService.getAllSlots(); // 0-8 hotbar, 9-35 inventory

    // 1. Try to stack in existing stacks (hotbar priority, then inventory)
    for (let i = 0; i < 36; i++) {
      const slot = slots[i];
      if (slot.item === itemId && slot.count < this.getMaxStack(itemId)) {
        const canAdd = this.getMaxStack(itemId) - slot.count;
        const add = Math.min(canAdd, quantity);
        
        // Create updated slot object
        const updatedSlot = { ...slot, count: slot.count + add };
        this.inventoryService.updateSlot(i, updatedSlot);
        
        quantity -= add;
        if (quantity === 0) return;
      }
    }

    // 2. If not fully stacked, find first empty slot (hotbar 0-8, then main)
    for (let i = 0; i < 36; i++) {
      if (slots[i].item === null) {
        const add = Math.min(quantity, this.getMaxStack(itemId));
        this.inventoryService.setSlot(i, itemId, add);
        
        quantity -= add;
        if (quantity === 0) return;
      }
    }

    // 3. If inventory full, drop on ground
    if (quantity > 0) {
      console.warn('Inventory full, dropping on ground:', itemId, quantity);
      // Future: DropEntitySystem.spawn(itemId, quantity, playerPos)
    }
  }

  private getMaxStack(itemId: string): number {
    return ITEMS_CONFIG[itemId]?.maxStack ?? 64;
  }
}

