
import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameSceneComponent } from './app/components/game-scene.component';
import { GameUiComponent } from './app/components/game-ui.component';
import { MainMenuComponent } from './app/components/main-menu.component';
import { GameStateService } from './app/services/game-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameSceneComponent, GameUiComponent, MainMenuComponent],
  templateUrl: './app.component.html',
  styleUrls: []
})
export class AppComponent {
  @ViewChild(GameSceneComponent) gameScene!: GameSceneComponent;
  
  store = inject(GameStateService);

  onRequestLock() {
    if (this.gameScene) {
      this.gameScene.lockControls();
    }
  }
}
