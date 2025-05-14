from pydantic import BaseModel
from typing import List, Optional, Dict
from enum import Enum

class TaskType(str, Enum):
    HEADS = "Heads"
    TAILS = "Tails"

class TaskStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"

class PlayerStatus(str, Enum):
    WAITING = "Waiting"
    ACTIVE = "Active"
    IDLE = "Idle"

class Task(BaseModel):
    id: str
    type: TaskType
    description: str
    batch_number: int
    sub_batch_number: int = 0
    status: TaskStatus = TaskStatus.PENDING
    assigned_to: Optional[str] = None

class Player(BaseModel):
    id: str
    name: str
    current_tasks: List[Task] = []
    completed_tasks: List[Task] = []
    status: PlayerStatus = PlayerStatus.WAITING
    order: int
    current_batch: int = 1
    task_queue: Dict[int, List[Task]] = {}
    batch_start_time: Dict[int, int] = {}  # 存储每个批次的开始时间（毫秒时间戳）
    batch_completion_time: Dict[int, int] = {}  # 存储每个批次的完成时间（毫秒）

class Game(BaseModel):
    id: str
    players: List[Player]
    current_batch: int = 1
    max_batches: int
    tasks_per_batch: int
    tasks: List[Task]
    status: str = "waiting"  # waiting, in_progress, completed
    active_player_index: int = 0  # Index of the currently active player
    current_player_order: int = 0  # Current order in the task flow 