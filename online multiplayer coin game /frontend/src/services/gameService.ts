import axios from 'axios';
import { Game, WebSocketMessage } from '../types';

// 使用相对路径，确保请求通过 nginx 代理
const API_URL = '/api';
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';

export const gameService = {
    createGame: async (playerCount: number, maxBatches: number, tasksPerBatch: number): Promise<string> => {
        console.log('Creating game with params:', { playerCount, maxBatches, tasksPerBatch });
        const response = await axios.post(`${API_URL}/games/create`, null, {
            params: { player_count: playerCount, max_batches: maxBatches, tasks_per_batch: tasksPerBatch }
        });
        console.log('Game created:', response.data);
        return response.data.game_id;
    },

    checkGameExists: async (gameId: string): Promise<boolean> => {
        console.log('Checking if game exists:', gameId);
        const response = await axios.get(`${API_URL}/games/${gameId}/exists`);
        console.log('Game exists response:', response.data);
        return response.data.exists;
    },

    joinGame: async (gameId: string, playerName: string): Promise<string> => {
        console.log('Joining game:', { gameId, playerName });
        const response = await axios.post(`${API_URL}/games/${gameId}/join`, null, {
            params: { player_name: playerName }
        });
        console.log('Join game response:', response.data);
        return response.data.player_id;
    },

    startGame: async (gameId: string): Promise<void> => {
        console.log('Starting game:', gameId);
        await axios.post(`${API_URL}/games/${gameId}/start`);
        console.log('Game started');
    },

    getGameState: async (gameId: string): Promise<Game> => {
        console.log('Getting game state:', gameId);
        const response = await axios.get(`${API_URL}/games/${gameId}`);
        console.log('Game state:', response.data);
        return response.data;
    },

    flipCoin: async (gameId: string, taskId: string): Promise<void> => {
        console.log('Flipping coin:', { gameId, taskId });
        await axios.post(`${API_URL}/games/${gameId}/flip/${taskId}`);
        console.log('Coin flipped');
    },

    syncFlipCoin: async (gameId: string, taskId: string): Promise<void> => {
        console.log('Syncing flip coin:', { gameId, taskId });
        await axios.post(`${API_URL}/games/${gameId}/flip_coin/${taskId}`);
        console.log('Coin flip synced');
    },
};

export class WebSocketService {
    private ws: WebSocket | null = null;
    private gameId: string;
    private playerId: string;
    private onGameUpdate: (game: Game) => void;
    private onSyncFlipCoin: (taskId: string) => void;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;

    constructor(gameId: string, playerId: string, onGameUpdate: (game: Game) => void, onSyncFlipCoin: (taskId: string) => void) {
        this.gameId = gameId;
        this.playerId = playerId;
        this.onGameUpdate = onGameUpdate;
        this.onSyncFlipCoin = onSyncFlipCoin;
        console.log('WebSocket service initialized:', { gameId, playerId });
    }

    connect() {
        console.log('Connecting WebSocket...');
        this.ws = new WebSocket(`${WS_URL}/${this.playerId}`);
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            switch (message.type) {
                case 'game_update':
                case 'game_started':
                case 'task_completed':
                case 'batch_passed':
                    console.log('Updating game state:', message.data);
                    this.onGameUpdate(message.data);
                    break;
                case 'flip_coin':
                    console.log('Flipping coin:', message.task_id);
                    this.onSyncFlipCoin(message.task_id);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        };

        this.ws.onopen = () => {
            console.log('WebSocket connection opened');
            this.reconnectAttempts = 0;
            // Request initial game state
            this.getGameState();
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    private async getGameState() {
        try {
            const gameState = await gameService.getGameState(this.gameId);
            this.onGameUpdate(gameState);
        } catch (error) {
            console.error('Error getting game state:', error);
        }
    }

    private handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
        }
    }

    completeTask(taskId: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'complete_task',
                game_id: this.gameId,
                task_id: taskId
            };
            console.log('Sending complete task message:', message);
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
            // Try to reconnect and queue the message
            this.connect();
        }
    }

    flipCoin(taskId: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'flip_coin',
                game_id: this.gameId,
                task_id: taskId
            };
            console.log('Sending flip coin message:', message);
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
            this.connect();
        }
    }

    disconnect() {
        if (this.ws) {
            console.log('Disconnecting WebSocket');
            this.ws.close();
            this.ws = null;
        }
    }
}