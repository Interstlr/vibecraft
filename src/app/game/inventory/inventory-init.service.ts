import { Injectable } from '@angular/core';
import { InventoryService } from './inventory.service';
import { GameStateService } from '../../services/game-state.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryInitService {
  constructor(
    private inventoryService: InventoryService,
    private gameState: GameStateService
  ) {
    // We no longer init in constructor automatically
    // This service should be called explicitly by GameScene or MainMenu when starting a NEW game
  }

  initializeNewGameInventory() {
    // Explicitly reset to be sure
    for (let i = 0; i < 50; i++) {
       this.inventoryService.setSlot(i, null, 0);
    }

    // Add default tools: Shovel, Pickaxe, Sword, Axe (Stone)
    this.inventoryService.setSlot(0, 'stone_shovel', 1);
    this.inventoryService.setSlot(1, 'stone_pickaxe', 1);
    this.inventoryService.setSlot(2, 'stone_sword', 1);
    this.inventoryService.setSlot(3, 'stone_axe', 1);
  }
}

