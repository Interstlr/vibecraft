import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  // --- Game Flow ---
  isGameStarted = signal(false);
  isLoading = signal(false);
  loadingProgress = signal(0);

  // --- Stats ---
  fps = signal(0);
  blockCount = signal(0);
  playerPosition = signal({ x: 0, y: 0, z: 0 });

  // --- Inventory ---
  // Resources
  grassCount = signal(0);
  dirtCount = signal(0);
  stoneCount = signal(0);
  woodCount = signal(0);
  leavesCount = signal(0);
  
  // Tools / Special
  hasWorkbench = signal(0);
  hasAxe = signal(0);

  // --- UI State ---
  selectedSlot = signal(1); // 1-9
  isMenuOpen = signal(false);
  activeMenu = signal<'none' | 'inventory' | 'workbench' | 'pause'>('none');
  
  // --- Derived State ---
  selectedBlockName = computed(() => {
    const slot = this.selectedSlot();
    switch (slot) {
      case 1: return 'grass';
      case 2: return 'dirt';
      case 3: return 'stone';
      case 4: return 'wood';
      case 5: return 'leaves';
      case 8: return 'workbench';
      case 9: return 'axe';
      default: return 'grass';
    }
  });

  constructor() {}

  // Actions
  startGame() {
    this.isGameStarted.set(true);
    this.isLoading.set(true);
    this.loadingProgress.set(0);
  }

  setLoadingProgress(progress: number) {
    this.loadingProgress.set(progress);
    if (progress >= 100) {
        // Small delay to let the user see 100%
        setTimeout(() => {
            this.isLoading.set(false);
        }, 500);
    }
  }

  // Inventory Management
  addToInventory(type: string, count: number = 1) {
    switch (type) {
      case 'grass': this.grassCount.update(v => v + count); break;
      case 'dirt': this.dirtCount.update(v => v + count); break;
      case 'stone': this.stoneCount.update(v => v + count); break;
      case 'wood': this.woodCount.update(v => v + count); break;
      case 'leaves': this.leavesCount.update(v => v + count); break;
      case 'workbench': this.hasWorkbench.update(v => v + count); break;
      // Axe is a tool, not usually stacked in this simple version, but let's handle it if needed
    }
  }

  removeFromInventory(type: string, count: number = 1): boolean {
    let current = 0;
    switch (type) {
      case 'grass': current = this.grassCount(); break;
      case 'dirt': current = this.dirtCount(); break;
      case 'stone': current = this.stoneCount(); break;
      case 'wood': current = this.woodCount(); break;
      case 'leaves': current = this.leavesCount(); break;
      case 'workbench': current = this.hasWorkbench(); break;
      default: return true; // Tools or unknown items don't consume stack for now or handled separately
    }

    if (current >= count) {
      switch (type) {
        case 'grass': this.grassCount.set(current - count); break;
        case 'dirt': this.dirtCount.set(current - count); break;
        case 'stone': this.stoneCount.set(current - count); break;
        case 'wood': this.woodCount.set(current - count); break;
        case 'leaves': this.leavesCount.set(current - count); break;
        case 'workbench': this.hasWorkbench.set(current - count); break;
      }
      return true;
    }
    return false;
  }

  hasItem(type: string, count: number = 1): boolean {
    switch (type) {
      case 'grass': return this.grassCount() >= count;
      case 'dirt': return this.dirtCount() >= count;
      case 'stone': return this.stoneCount() >= count;
      case 'wood': return this.woodCount() >= count;
      case 'leaves': return this.leavesCount() >= count;
      case 'workbench': return this.hasWorkbench() >= count;
      case 'axe': return this.hasAxe() >= count;
      default: return false;
    }
  }

  closeMenus() {
    this.isMenuOpen.set(false);
    this.activeMenu.set('none');
  }

  openInventoryMenu() {
    this.isMenuOpen.set(true);
    this.activeMenu.set('inventory');
  }

  openWorkbenchMenu() {
    this.isMenuOpen.set(true);
    this.activeMenu.set('workbench');
  }

  openPauseMenu() {
    this.isMenuOpen.set(true);
    this.activeMenu.set('pause');
  }

  craftWorkbench() {
    if (this.woodCount() >= 4) {
      this.woodCount.update(v => v - 4);
      this.hasWorkbench.update(v => v + 1);
      this.closeMenus();
      return true;
    }
    return false;
  }

  craftAxe() {
    if (this.woodCount() >= 3) {
      this.woodCount.update(v => v - 3);
      this.hasAxe.update(v => v + 1);
      this.closeMenus();
      return true;
    }
    return false;
  }
}
