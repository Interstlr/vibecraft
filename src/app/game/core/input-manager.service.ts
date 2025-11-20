import { Injectable } from '@angular/core';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { SceneManagerService } from './scene-manager.service';
import { GameStateService } from '../../services/game-state.service';
import { InventoryService } from '../inventory/inventory.service';

export interface InteractionCallbacks {
  onPrimaryDown: () => void;
  onPrimaryUp: () => void;
  onSecondaryDown: () => void;
}

export interface MovementState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class InputManagerService {
  private controls!: PointerLockControls;
  private callbacks: InteractionCallbacks | null = null;
  private movement: MovementState = { forward: false, backward: false, left: false, right: false };
  private jumpActive = false;

  private keyDownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);
  private keyUpHandler = (event: KeyboardEvent) => this.handleKeyUp(event);
  private mouseDownHandler = (event: MouseEvent) => this.handleMouseDown(event);
  private mouseUpHandler = (event: MouseEvent) => this.handleMouseUp(event);

  constructor(
    private sceneManager: SceneManagerService,
    private store: GameStateService,
    private inventoryService: InventoryService,
  ) {}

  initialize(callbacks: InteractionCallbacks) {
    this.callbacks = callbacks;
    this.controls = new PointerLockControls(this.sceneManager.getCamera(), document.body);

    this.controls.addEventListener('lock', () => {
      this.store.showInstructions.set(false);
      if (this.store.isMenuOpen()) {
        this.store.closeMenus();
      }
    });

    this.controls.addEventListener('unlock', () => {
      if (this.callbacks) {
        this.callbacks.onPrimaryUp();
      }
      this.jumpActive = false;
      if (!this.store.isMenuOpen()) {
        this.store.showInstructions.set(true);
      }
    });

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
    window.addEventListener('mousedown', this.mouseDownHandler);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  dispose() {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    window.removeEventListener('mousedown', this.mouseDownHandler);
    window.removeEventListener('mouseup', this.mouseUpHandler);
  }

  lockPointer() {
    this.controls?.lock();
  }

  unlockPointer() {
    this.controls?.unlock();
  }

  isLocked(): boolean {
    return this.controls?.isLocked ?? false;
  }

  getMovementState(): MovementState {
    return { ...this.movement };
  }

  isJumpHeld(): boolean {
    return this.jumpActive;
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.code === 'Escape') {
      if (this.store.activeMenu() !== 'none') {
        this.store.closeMenus();
        if (!this.controls.isLocked) {
          this.controls.lock();
        }
        event.preventDefault();
      }
      return;
    }

    if (event.code === 'KeyE') {
      if (this.controls.isLocked) {
        this.store.openInventoryMenu();
        this.controls.unlock();
      } else if (this.store.activeMenu() === 'inventory') {
        this.store.closeMenus();
        this.controls.lock();
      }
      event.preventDefault();
      return;
    }

    if (this.controls && this.controls.isLocked) {
      switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
          this.movement.forward = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          this.movement.left = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
          this.movement.backward = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.movement.right = true;
          break;
        case 'Space':
          event.preventDefault();
          this.jumpActive = true;
          break;
        case 'Digit1': this.inventoryService.selectHotbarSlot(0); break;
        case 'Digit2': this.inventoryService.selectHotbarSlot(1); break;
        case 'Digit3': this.inventoryService.selectHotbarSlot(2); break;
        case 'Digit4': this.inventoryService.selectHotbarSlot(3); break;
        case 'Digit5': this.inventoryService.selectHotbarSlot(4); break;
        case 'Digit6': this.inventoryService.selectHotbarSlot(5); break;
        case 'Digit7': this.inventoryService.selectHotbarSlot(6); break;
        case 'Digit8': this.inventoryService.selectHotbarSlot(7); break;
        case 'Digit9': this.inventoryService.selectHotbarSlot(8); break;
      }
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.movement.forward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.movement.left = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.movement.backward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.movement.right = false;
        break;
      case 'Space':
        this.jumpActive = false;
        break;
    }
  }

  private handleMouseDown(event: MouseEvent) {
    if (!this.controls.isLocked || !this.callbacks) {
      return;
    }

    event.preventDefault();

    if (event.button === 0) {
      this.callbacks.onPrimaryDown();
    } else if (event.button === 2) {
      this.callbacks.onSecondaryDown();
    }
  }

  private handleMouseUp(event: MouseEvent) {
    if (!this.controls.isLocked || !this.callbacks) {
      return;
    }

    event.preventDefault();

    if (event.button === 0) {
      this.callbacks.onPrimaryUp();
    }
  }
}

