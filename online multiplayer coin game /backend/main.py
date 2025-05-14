from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import json
from game_logic import GameManager
from models import Game, Player
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Coin Game API")

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://172.20.10.4:3000",  # 你的本地IP地址
         "*"  # 允许所有来源，这样其他设备可以通过IP访问
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 游戏管理器实例
game_manager = GameManager()

# 存储活跃的WebSocket连接
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")

    async def broadcast_to_game(self, game_id: str, message: dict):
        game = game_manager.get_game_state(game_id)
        if game:
            logger.info(f"Broadcasting to game {game_id}: {message}")
            for player in game.players:
                if player.id in self.active_connections:
                    await self.active_connections[player.id].send_json(message)

manager = ConnectionManager()

@app.get("/games/{game_id}/exists")
async def check_game_exists(game_id: str):
    game = game_manager.get_game_state(game_id)
    logger.info(f"Checking if game {game_id} exists: {game is not None}")
    return {"exists": game is not None}

@app.post("/games/create")
async def create_game(
    player_count: int = Query(...),
    max_batches: int = Query(...),
    tasks_per_batch: int = Query(...)
):
    logger.info(f"Creating game with {player_count} players, {max_batches} batches, {tasks_per_batch} tasks per batch")
    game = game_manager.create_game(player_count, max_batches, tasks_per_batch)
    return {"game_id": game.id}

@app.post("/games/{game_id}/join")
async def join_game(game_id: str, player_name: str):
    logger.info(f"Player {player_name} joining game {game_id}")
    player = game_manager.add_player(game_id, player_name)
    if not player:
        logger.error(f"Failed to join game {game_id}")
        raise HTTPException(status_code=400, detail="Cannot join game")
    
    # 获取并广播更新后的游戏状态
    game_state = game_manager.get_game_state(game_id)
    await manager.broadcast_to_game(game_id, {
        "type": "game_update",
        "data": game_state.dict()
    })
    
    return {"player_id": player.id}

@app.post("/games/{game_id}/start")
async def start_game(game_id: str):
    logger.info(f"Starting game {game_id}")
    success = game_manager.start_game(game_id)
    if not success:
        logger.error(f"Failed to start game {game_id}")
        raise HTTPException(status_code=400, detail="Cannot start game")
    
    game_state = game_manager.get_game_state(game_id)
    await manager.broadcast_to_game(game_id, {
        "type": "game_started",
        "data": game_state.dict()
    })
    return {"status": "started"}

@app.get("/games/{game_id}")
async def get_game_state(game_id: str):
    logger.info(f"Getting state for game {game_id}")
    game = game_manager.get_game_state(game_id)
    if not game:
        logger.error(f"Game {game_id} not found")
        raise HTTPException(status_code=404, detail="Game not found")
    return game

@app.post("/games/{game_id}/flip/{task_id}")
async def flip_coin(game_id: str, task_id: str):
    logger.info(f"Flipping coin in game {game_id}, task {task_id}")
    success = game_manager.flip_coin(game_id, task_id)
    if not success:
        logger.error(f"Failed to flip coin in game {game_id}")
        raise HTTPException(status_code=400, detail="Cannot flip coin")
    
    # Get and broadcast updated game state
    game_state = game_manager.get_game_state(game_id)
    await manager.broadcast_to_game(game_id, {
        "type": "game_update",
        "data": game_state.dict()
    })
    return {"status": "flipped"}

@app.post("/games/{game_id}/flip_coin/{task_id}")
async def flip_coins(game_id: str, task_id: str):
    # Get and broadcast updated game state
    await manager.broadcast_to_game(game_id, {
        "type": "flip_coin",
        "task_id": task_id
    })
    return {"status": "flipped"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"Received message from client {client_id}: {message}")
            
            if message["type"] == "complete_task":
                game_id = message["game_id"]
                task_id = message["task_id"]
                success = game_manager.complete_task(game_id, client_id, task_id)
                
                if success:
                    game_state = game_manager.get_game_state(game_id)
                    await manager.broadcast_to_game(game_id, {
                        "type": "game_update",
                        "data": game_state.dict()
                    })

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"Error in websocket connection: {str(e)}")
        manager.disconnect(client_id) 