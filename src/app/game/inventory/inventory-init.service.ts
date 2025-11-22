import { Injectable } from '@angular/core';
import { InventoryService } from './inventory.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryInitService {
  constructor(private inventoryService: InventoryService) {
    // Ensure inventory is clean on start
    this.init();
  }

  private init() {
    // The InventoryService signal initializes with empty slots (null item, 0 count).
    // If there's logic to load save data or set starting kit, it goes here.
    
    // We can explicitly reset to be sure
    for (let i = 0; i < 50; i++) {
       this.inventoryService.setSlot(i, null, 0);
    }

    // Add default tools: Shovel, Pickaxe, Sword, Axe (Wooden)
    this.inventoryService.setSlot(0, 'wooden_shovel', 1);
    this.inventoryService.setSlot(1, 'wooden_pickaxe', 1);
    this.inventoryService.setSlot(2, 'wooden_sword', 1);
    this.inventoryService.setSlot(3, 'wooden_axe', 1);
  }
}

