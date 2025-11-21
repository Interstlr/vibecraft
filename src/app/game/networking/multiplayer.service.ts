import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject, ReplaySubject } from 'rxjs';
import * as THREE from 'three';
import { environment } from '../../../environments/environment';

export interface PlayerData {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  item?: string | null;
}

export interface BlockUpdateData {
  x: number;
  y: number;
  z: number;
  type?: string;
  action: 'add' | 'remove';
}

@Injectable({
  providedIn: 'root',
})
export class MultiplayerService {
  private socket!: Socket;
  private connected = false;
  private playerId: string | null = null;

  public playerJoined$ = new Subject<PlayerData>();
  public playerLeft$ = new Subject<string>();
  public playerMoved$ = new Subject<PlayerData>();
  public blockUpdated$ = new Subject<BlockUpdateData>();
  public connected$ = new Subject<boolean>();
  
  // Emits when initial world data is received
  public worldInitialized$ = new ReplaySubject<Record<string, BlockUpdateData>>(1);
  public worldSeed$ = new ReplaySubject<number>(1);

  // Initial state from server
  public initialPlayers: Record<string, PlayerData> = {};
  public initialWorldChanges: Record<string, BlockUpdateData> = {};

  constructor() {}

  initialize() {
    // Check environment config
    if (!environment.multiplayer) {
      console.log('Multiplayer disabled in environment');
      return;
    }

    // Connect to the same host/port that served the page
    // If in dev mode (ng serve at 4200), we might want to fallback to localhost:3000,
    // but for production build served by node, relative path is better or window.location
    
    const isDev = window.location.port === '4200';
    const url = isDev ? 'http://localhost:3000' : window.location.origin;
    
    console.log('Connecting to socket.io at:', url);
    this.socket = io(url, {
        transports: ['websocket', 'polling']
    });

    this.socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err);
    });

    this.socket.on('connect', () => {
      console.log('Connected to multiplayer server');
      this.connected = true;
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from multiplayer server');
      this.connected = false;
      this.connected$.next(false);
    });

    this.socket.on('init', (data: { id: string; seed: number; players: Record<string, PlayerData>; worldChanges: Record<string, BlockUpdateData> }) => {
      this.playerId = data.id;
      this.initialPlayers = data.players;
      this.initialWorldChanges = data.worldChanges;
      this.worldInitialized$.next(data.worldChanges);
      if (data.seed) {
          console.log('Received world seed:', data.seed);
          this.worldSeed$.next(data.seed);
      }
      console.log('Initialized with id:', this.playerId);
    });

    this.socket.on('player-join', (data: PlayerData) => {
      if (data.id !== this.playerId) {
        console.log(`Player connected: ${data.id}`);
        this.playerJoined$.next(data);
      }
    });

    this.socket.on('player-leave', (id: string) => {
      console.log(`Player disconnected: ${id}`);
      this.playerLeft$.next(id);
    });

    this.socket.on('player-move', (data: PlayerData) => {
      this.playerMoved$.next(data);
    });

    this.socket.on('block-update', (data: BlockUpdateData) => {
      this.blockUpdated$.next(data);
    });
  }

  sendMove(position: THREE.Vector3, rotation: THREE.Euler, item: string | null) {
    if (!this.connected) return;
    this.socket.emit('move', {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      item: item
    });
  }

  sendBlockUpdate(x: number, y: number, z: number, type: string | null, action: 'add' | 'remove') {
    if (!this.connected) return;
    this.socket.emit('block-update', { x, y, z, type, action });
  }

  getPlayerId(): string | null {
    return this.playerId;
  }
}
