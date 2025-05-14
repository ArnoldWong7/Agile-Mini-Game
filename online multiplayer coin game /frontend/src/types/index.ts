export enum TaskType {
    HEADS = "Heads",
    TAILS = "Tails"
}

export enum TaskStatus {
    PENDING = "Pending",
    IN_PROGRESS = "In Progress",
    COMPLETED = "Completed"
}

export enum PlayerStatus {
    WAITING = "Waiting",
    ACTIVE = "Active",
    IDLE = "Idle"
}

export interface Task {
    id: string;
    type: TaskType;
    description: string;
    status: TaskStatus;
    assigned_to: string | null;
    batch_number: number;
    sub_batch_number: number;
}

export interface Player {
    id: string;
    name: string;
    current_tasks: Task[];
    completed_tasks: Task[];
    status: PlayerStatus;
    order: number;
    current_batch: number;
    batch_start_time: { [key: number]: number };  // 每个批次的开始时间
    batch_completion_time: { [key: number]: number };  // 每个批次的完成时间
}

export interface Game {
    id: string;
    players: Player[];
    current_batch: number;
    max_batches: number;
    tasks_per_batch: number;
    tasks: Task[];
    status: string;
    active_player_index: number;
    current_player_order: number;
}

export interface WebSocketMessage {
    type: string;
    data: any;
} 