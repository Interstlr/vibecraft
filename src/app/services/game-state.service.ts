
import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  // --- Game Flow ---
  isGameStarted = signal(false);

  // --- Stats ---
  fps = signal(0);
  blockCount = signal(0);

  // --- Inventory ---
  woodCount = signal(0);
  hasWorkbench = signal(0);
  hasAxe = signal(0);

  // --- UI State ---
  selectedSlot = signal(1); // 1-6
  isMenuOpen = signal(false);
  activeMenu = signal<'none' | 'crafting' | 'workbench'>('none');
  showInstructions = signal(true);
  
  // --- Mining State ---
  miningProgress = signal(0);
  isMiningVisible = computed(() => this.miningProgress() > 0);

  // --- Derived State ---
  selectedBlockName = computed(() => {
    const slot = this.selectedSlot();
    if (slot === 1) return 'grass';
    if (slot === 2) return 'dirt';
    if (slot === 3) return 'stone';
    if (slot === 4) return 'wood';
    if (slot === 5) return 'workbench';
    if (slot === 6) return 'axe';
    return 'grass';
  });

  constructor() {}

  // Actions
  startGame() {
    this.isGameStarted.set(true);
  }

  closeMenus() {
    this.isMenuOpen.set(false);
    this.activeMenu.set('none');
  }

  openCraftingMenu() {
    this.isMenuOpen.set(true);
    this.activeMenu.set('crafting');
  }

  openWorkbenchMenu() {
    this.isMenuOpen.set(true);
    this.activeMenu.set('workbench');
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
