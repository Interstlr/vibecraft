import { Injectable, signal, computed } from '@angular/core';
import { InventorySlot } from './inventory-slot';
import { CraftingSystemService } from './crafting-system.service';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  // Indices:
  // 0-8: Hotbar (9)
  // 9-35: Main Inventory (27)
  // 36: Offhand (1)
  // 37-45: Crafting Input (9) - Supports up to 3x3
  // 46: Crafting Result (1)
  private readonly TOTAL_SLOTS = 50;
  public readonly RESULT_SLOT = 46;
  
  readonly slots = signal<InventorySlot[]>(
    Array(this.TOTAL_SLOTS).fill(null).map(() => ({ item: null, count: 0 }))
  );

  readonly selectedHotbarIndex = signal(0);
  readonly heldItem = signal<InventorySlot>({ item: null, count: 0 });
  readonly craftingGridSize = signal<2 | 3>(2);

  readonly selectedItem = computed(() => {
    const slots = this.slots();
    const index = this.selectedHotbarIndex();
    if (index >= 0 && index < 9) {
      return slots[index];
    }
    return { item: null, count: 0 };
  });

  constructor(private craftingSystem: CraftingSystemService) {
    // Inventory starts empty
  }

  setSlots(slots: InventorySlot[]) {
    if (slots.length !== this.TOTAL_SLOTS) {
        // If size mismatch (e.g. from older save), try to map correctly or pad
        const newSlots = Array(this.TOTAL_SLOTS).fill(null).map(() => ({ item: null, count: 0 }));
        slots.forEach((s, i) => {
            if (i < this.TOTAL_SLOTS) newSlots[i] = s;
        });
        this.slots.set(newSlots);
    } else {
        this.slots.set(slots);
    }
  }

  getAllSlots(): InventorySlot[] {
    return this.slots();
  }

  getSlot(index: number): InventorySlot {
    return this.slots()[index];
  }

  setSlot(index: number, item: string | null, count: number) {
    if (index < 0 || index >= this.TOTAL_SLOTS) return;
    
    this.slots.update(current => {
      const newSlots = [...current];
      newSlots[index] = { 
        item: count > 0 ? item : null, 
        count: count > 0 ? count : 0 
      };
      return newSlots;
    });

    if (index >= 37 && index <= 45) {
      this.checkCrafting();
    }
  }

  updateSlot(index: number, slot: InventorySlot) {
    this.setSlot(index, slot.item, slot.count);
  }

  setCraftingGridSize(size: 2 | 3) {
    const current = this.craftingGridSize();
    if (current === size) return;
    
    this.craftingGridSize.set(size);
    this.checkCrafting();
  }

  removeOneFromSelected(): boolean {
    const index = this.selectedHotbarIndex();
    const slot = this.getSlot(index);
    if (slot.item && slot.count > 0) {
      this.setSlot(index, slot.item, slot.count - 1);
      return true;
    }
    return false;
  }
  
  // Drop one from held item, returns what was dropped
  dropOneHeld(): InventorySlot | null {
    const held = this.heldItem();
    if (!held.item || held.count <= 0) return null;

    const dropped = { item: held.item, count: 1 };
    
    if (held.count > 1) {
      this.heldItem.set({ item: held.item, count: held.count - 1 });
    } else {
      this.heldItem.set({ item: null, count: 0 });
    }
    
    return dropped;
  }

  // Drop all held items, returns what was dropped
  dropAllHeld(): InventorySlot | null {
    const held = this.heldItem();
    if (!held.item || held.count <= 0) return null;

    const dropped = { ...held };
    this.heldItem.set({ item: null, count: 0 });
    return dropped;
  }

  getItemCount(item: string): number {
    return this.slots().reduce((acc, slot, i) => {
      if (i < 36 && slot.item === item) return acc + slot.count;
      return acc;
    }, 0);
  }

  selectHotbarSlot(index: number) {
    if (index >= 0 && index < 9) {
      this.selectedHotbarIndex.set(index);
    }
  }

  handleSlotClick(index: number, button: 'left' | 'right' | 'middle' | 'shift-left') {
    if (index === this.RESULT_SLOT) {
      this.handleResultSlotClick();
      return;
    }

    const slot = this.getSlot(index);
    const held = this.heldItem();

    if (button === 'shift-left') {
      this.handleShiftClick(index);
      return;
    }

    this.slots.update(current => {
      const newSlots = [...current];
      const currentSlot = { ...newSlots[index] };
      let newHeld = { ...held };

      if (button === 'left') {
        if (!newHeld.item) {
          if (currentSlot.item) {
            newHeld = { ...currentSlot };
            newSlots[index] = { item: null, count: 0 };
          }
        } else {
          if (!currentSlot.item) {
            newSlots[index] = { ...newHeld };
            newHeld = { item: null, count: 0 };
          } else if (currentSlot.item === newHeld.item) {
             const slotMax = 64; 
             const space = slotMax - currentSlot.count;
             const add = Math.min(space, newHeld.count);
             newSlots[index].count += add;
             newHeld.count -= add;
             if (newHeld.count === 0) newHeld.item = null;
          } else {
            const temp = { ...currentSlot };
            newSlots[index] = { ...newHeld };
            newHeld = temp;
          }
        }
      } else if (button === 'right') {
        if (!newHeld.item && currentSlot.item) {
          const half = Math.ceil(currentSlot.count / 2);
          newHeld = { item: currentSlot.item, count: half };
          newSlots[index].count -= half;
          if (newSlots[index].count === 0) newSlots[index].item = null;
        } else if (newHeld.item) {
          if (!currentSlot.item) {
            newSlots[index] = { item: newHeld.item, count: 1 };
            newHeld.count--;
            if (newHeld.count === 0) newHeld.item = null;
          } else if (currentSlot.item === newHeld.item && currentSlot.count < 64) {
            newSlots[index].count++;
            newHeld.count--;
            if (newHeld.count === 0) newHeld.item = null;
          }
        }
      }

      this.heldItem.set(newHeld);
      return newSlots;
    });

    if (index >= 37 && index <= 45) {
      this.checkCrafting();
    }
  }

  private handleResultSlotClick() {
    const result = this.getSlot(this.RESULT_SLOT);
    if (!result.item) return;

    const held = this.heldItem();
    
    if (held.item && (held.item !== result.item || held.count + result.count > 64)) {
      return; // Cannot pick up
    }

    this.slots.update(current => {
      const newSlots = [...current];
      
      // Add to held
      if (!held.item) {
        this.heldItem.set({ ...result });
      } else {
        this.heldItem.set({ item: held.item, count: held.count + result.count });
      }

      // Consume ingredients
      const size = this.craftingGridSize();
      // In 2x2, we use 4 slots. In 3x3, 9 slots.
      // We need to know which indices correspond to the grid.
      // Based on checkCrafting logic below:
      const indices = size === 2 
        ? [37, 38, 39, 40] 
        : [37, 38, 39, 40, 41, 42, 43, 44, 45];

      for (const i of indices) {
        if (newSlots[i].item) {
          newSlots[i].count--;
          if (newSlots[i].count === 0) newSlots[i].item = null;
        }
      }
      
      newSlots[this.RESULT_SLOT] = { item: null, count: 0 };
      return newSlots;
    });

    this.checkCrafting();
  }

  private handleShiftClick(index: number) {
    // TODO: Implement shift click
  }

  private checkCrafting() {
    const slots = this.slots();
    const size = this.craftingGridSize();
    
    let inputs: InventorySlot[] = [];
    
    if (size === 2) {
      // Use first 4 slots as 2x2
      inputs = [slots[37], slots[38], slots[39], slots[40]];
    } else {
      // Use 9 slots as 3x3
      inputs = slots.slice(37, 46);
    }
    
    const result = this.craftingSystem.findRecipe(inputs, size);
    
    this.slots.update(current => {
      const newSlots = [...current];
      newSlots[this.RESULT_SLOT] = result || { item: null, count: 0 };
      return newSlots;
    });
  }
}
