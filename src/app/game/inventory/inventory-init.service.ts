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
    // For now, complying with "Called once at start... empty"
    
    // We can explicitly reset to be sure
    for (let i = 0; i < 50; i++) {
       this.inventoryService.setSlot(i, null, 0);
    }
  }
}

