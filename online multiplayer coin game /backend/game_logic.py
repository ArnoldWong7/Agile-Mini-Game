import uuid
import random
import time
from typing import List, Optional
from models import Game, Player, Task, TaskStatus, TaskType, PlayerStatus

class GameManager:
    def __init__(self):
        self.games = {}
        # 定义每轮的子批次结构
        self.batch_structure = {
            1: [(0, 20)],          # 第1轮：1个批次×20枚
            2: [(0, 10), (1, 10)], # 第2轮：2个批次×10枚
            3: [(i, 5) for i in range(4)],  # 第3轮：4个批次×5枚
            4: [(i, 2) for i in range(10)]  # 第4轮：10个批次×2枚
        }

    def create_game(self, player_count: int, max_batches: int, coins_per_batch: int) -> Game:
        game_id = str(uuid.uuid4())[:6].upper()
        
        # 修改为固定4轮，每轮20枚硬币
        max_batches = 4
        coins_per_batch = 20
        
        # 修改批次结构定义以匹配游戏规则
        self.batch_structure = {
            1: [(0, 20)],          # 第1轮：1个批次×20枚
            2: [(0, 10), (1, 10)], # 第2轮：2个批次×10枚
            3: [(i, 5) for i in range(4)],  # 第3轮：4个批次×5枚
            4: [(i, 2) for i in range(10)]  # 第4轮：10个批次×2枚
        }
        
        tasks = []
        task_types = list(TaskType)
        task_descriptions = {
            TaskType.HEADS: ["Flip coin to Heads"],
            TaskType.TAILS: ["Flip coin to Tails"]
        }

        # 为每轮生成任务
        for batch_num in range(1, 5):  # 4轮游戏
            # 为这轮选择目标类型
            batch_task_type = random.choice(task_types)
            description = task_descriptions[batch_task_type][0]
            
            # 获取这轮的子批次结构
            sub_batches = self.batch_structure[batch_num]
            
            # 为每个子批次创建任务
            for sub_batch_idx, coins_count in sub_batches:
                for _ in range(coins_count):
                    task = Task(
                        id=str(uuid.uuid4()),
                        type=batch_task_type,
                        description=f"{description} (Round {batch_num}, Sub-batch {sub_batch_idx + 1})",
                        batch_number=batch_num,
                        sub_batch_number=sub_batch_idx
                    )
                    tasks.append(task)

        game = Game(
            id=game_id,
            players=[],
            max_batches=4,
            tasks_per_batch=20,
            tasks=tasks
        )
        self.games[game_id] = game
        return game

    def _generate_tasks(self, player_count: int, max_batches: int, coins_per_batch: int) -> List[Task]:
        tasks = []
        task_types = list(TaskType)
        task_descriptions = {
            TaskType.HEADS: ["Flip coin to Heads"],
            TaskType.TAILS: ["Flip coin to Tails"]
        }

        # First, generate a list of target types for each batch
        batch_targets = [random.choice(task_types) for _ in range(max_batches)]

        # Then create tasks for each batch using the predetermined target
        for batch in range(1, max_batches + 1):
            batch_task_type = batch_targets[batch - 1]  # Get the predetermined target for this batch
            description = task_descriptions[batch_task_type][0]
            
            # Create tasks for this batch (only tasks_per_batch amount)
            batch_tasks = []
            for _ in range(coins_per_batch):  # Remove the multiplication by player_count
                task = Task(
                    id=str(uuid.uuid4()),
                    type=batch_task_type,
                    description=f"{description} (Batch {batch})",
                    batch_number=batch
                )
                batch_tasks.append(task)
            
            tasks.extend(batch_tasks)
        
        return tasks

    def add_player(self, game_id: str, player_name: str) -> Optional[Player]:
        if game_id not in self.games:
            return None
        
        game = self.games[game_id]
        if game.status != "waiting":
            return None

        player = Player(
            id=str(uuid.uuid4()),
            name=player_name,
            order=len(game.players),  # Assign order based on join sequence
            status=PlayerStatus.WAITING,
            current_batch=1  # Initialize current_batch to 1
        )
        game.players.append(player)
        return player

    def start_game(self, game_id: str) -> bool:
        if game_id not in self.games:
            return False
        
        game = self.games[game_id]
        if len(game.players) < 2:
            return False

        game.status = "in_progress"
        game.current_batch = 1
        
        # 只为第一个玩家分配第一批次的任务
        first_player = game.players[0]
        first_player.status = PlayerStatus.ACTIVE
        first_player.current_batch = 1
        first_player.batch_start_time = {1: int(time.time() * 1000)}
        
        # 分配第一批次的所有任务给第一个玩家
        current_batch_tasks = [t for t in game.tasks if t.batch_number == 1]
        for task in current_batch_tasks:
            task.assigned_to = first_player.id
            first_player.current_tasks.append(task)
        
        # 其他玩家设置为等待状态
        for player in game.players[1:]:
            player.status = PlayerStatus.WAITING
            player.current_batch = 1
        
        return True

    def _assign_batch_tasks(self, game: Game, player: Player):
        """Assign current batch tasks to a player"""
        current_batch_tasks = [t for t in game.tasks 
                             if t.batch_number == game.current_batch 
                             and t.status == TaskStatus.PENDING]
        
        for task in current_batch_tasks:
            task.assigned_to = player.id
            player.current_tasks.append(task)

    def _pass_completed_task_to_next_player(self, game: Game, from_player: Player, batch_number: int) -> bool:
        """将指定批次的已完成任务传递给下一个玩家，返回是否传递成功"""
        if from_player.order == len(game.players) - 1:
            return True  # 最后一个玩家不需要传递任务，直接返回成功
            
        next_player = game.players[from_player.order + 1]
        print(f"Attempting to pass batch {batch_number} tasks from {from_player.name} to {next_player.name}")
        
        # 严格检查：确保当前玩家已完成该批次的所有任务
        from_player_batch_tasks = [t for t in game.tasks 
                                 if t.batch_number == batch_number 
                                 and t.assigned_to == from_player.id]
        completed_tasks = [t for t in from_player_batch_tasks if t.status == TaskStatus.COMPLETED]
        
        print(f"Batch {batch_number} tasks for {from_player.name}: {len(completed_tasks)}/{len(from_player_batch_tasks)} completed")
        
        if len(completed_tasks) != len(from_player_batch_tasks):
            print(f"Player {from_player.name} has not completed all tasks in batch {batch_number}")
            return False
        
        # 为下一个玩家创建新的任务实例
        next_batch_tasks = []
        for task in completed_tasks:
            new_task = self._clone_task(task)
            new_task.batch_number = batch_number
            new_task.assigned_to = next_player.id
            game.tasks.append(new_task)
            next_batch_tasks.append(new_task)
        
        print(f"Created {len(next_batch_tasks)} new tasks for batch {batch_number}")
        
        # 初始化任务队列（如果需要）
        if batch_number not in next_player.task_queue:
            next_player.task_queue = {}
            
        # 将任务添加到队列中
        next_player.task_queue.setdefault(batch_number, []).extend(next_batch_tasks)
        print(f"Added {len(next_batch_tasks)} tasks to {next_player.name}'s queue for batch {batch_number}")
        
        # 检查是否可以立即激活这些任务
        if self._can_activate_batch(game, next_player, batch_number):
            # 设置批次开始时间
            next_player.batch_start_time[batch_number] = int(time.time() * 1000)
            self._activate_batch_tasks(game, next_player, batch_number)
            print(f"Immediately activated batch {batch_number} for {next_player.name}")
        else:
            print(f"Batch {batch_number} tasks queued for {next_player.name} until they finish previous batch")
            
        return True

    def _can_activate_batch(self, game: Game, player: Player, batch_number: int) -> bool:
        """检查玩家是否可以激活指定批次的任务"""
        # 1. 没有正在进行的任务
        if player.current_tasks:
            return False
            
        # 2. 该批次任务存在于队列中
        if not hasattr(player, 'task_queue') or batch_number not in player.task_queue or not player.task_queue[batch_number]:
            return False
            
        # 3. 是第一个玩家或前一个玩家已完成相应的子批次
        if player.order == 0:
            return True
            
        # 获取前一个玩家
        prev_player = game.players[player.order - 1]
        
        # 获取当前要激活的任务的子批次号
        tasks_to_activate = player.task_queue[batch_number]
        if not tasks_to_activate:
            return False
        sub_batch_number = tasks_to_activate[0].sub_batch_number
        
        # 检查前一个玩家的相应子批次是否完成
        prev_player_sub_batch_tasks = [t for t in game.tasks 
                                      if t.batch_number == batch_number 
                                      and t.sub_batch_number == sub_batch_number
                                      and t.assigned_to == prev_player.id]
                                  
        if not prev_player_sub_batch_tasks:
            return False
            
        return all(t.status == TaskStatus.COMPLETED for t in prev_player_sub_batch_tasks)

    def _activate_batch_tasks(self, game: Game, player: Player, batch_number: int) -> None:
        """激活指定批次的任务"""
        if not hasattr(player, 'task_queue') or batch_number not in player.task_queue:
            return
            
        tasks_to_activate = player.task_queue[batch_number]
        if not tasks_to_activate:
            return
            
        print(f"Activating {len(tasks_to_activate)} tasks for batch {batch_number} for {player.name}")
        player.current_tasks.extend(tasks_to_activate)
        player.current_batch = batch_number
        player.status = PlayerStatus.ACTIVE
        
        # 设置批次开始时间（如果还没有设置）
        if batch_number not in player.batch_start_time:
            player.batch_start_time[batch_number] = int(time.time() * 1000)
            
        # 从队列中移除已激活的任务
        del player.task_queue[batch_number]

    def _handle_batch_completion(self, game: Game, player: Player, completed_batch: int):
        """处理指定批次的完成情况"""
        print(f"Handling completion of batch {completed_batch} for player {player.name}")
        
        # 记录批次完成时间
        if completed_batch in player.batch_start_time and completed_batch not in player.batch_completion_time:
            completion_time = int(time.time() * 1000) - player.batch_start_time[completed_batch]
            player.batch_completion_time[completed_batch] = completion_time
            print(f"Recorded completion time for batch {completed_batch}: {completion_time}ms")
        
        # 检查是否是最后一个玩家
        is_last_player = player.order == len(game.players) - 1
        
        # 如果是最后一个玩家且是最后一个批次，结束游戏
        if is_last_player and completed_batch == game.max_batches:
            print("Final batch completed by last player, game is completed")
            game.status = "completed"
            for p in game.players:
                p.status = PlayerStatus.IDLE
                p.current_tasks = []
            return True
        
        # 1. 立即将完成的批次传递给下一个玩家（如果不是最后一个玩家）
        if not is_last_player:
            next_player = game.players[player.order + 1]
            
            # 获取当前玩家完成的所有子批次任务，按子批次分组
            completed_tasks_by_sub_batch = {}
            for t in game.tasks:
                if (t.batch_number == completed_batch and 
                    t.assigned_to == player.id and 
                    t.status == TaskStatus.COMPLETED):
                    if t.sub_batch_number not in completed_tasks_by_sub_batch:
                        completed_tasks_by_sub_batch[t.sub_batch_number] = []
                    completed_tasks_by_sub_batch[t.sub_batch_number].append(t)
            
            # 检查下一个玩家是否已经有这个批次的任务
            existing_sub_batches = {t.sub_batch_number for t in game.tasks 
                                  if t.batch_number == completed_batch 
                                  and t.assigned_to == next_player.id}
            
            # 为每个子批次创建新任务，保持相同的位置
            for sub_batch_number, tasks in completed_tasks_by_sub_batch.items():
                if sub_batch_number in existing_sub_batches:
                    print(f"Sub-batch {sub_batch_number} already exists for {next_player.name}, skipping")
                    continue
                
                print(f"Creating tasks for sub-batch {sub_batch_number} for {next_player.name}")
                for task in tasks:
                    new_task = self._clone_task(task)
                    new_task.batch_number = completed_batch
                    new_task.sub_batch_number = task.sub_batch_number  # 保持相同的子批次编号
                    new_task.assigned_to = next_player.id
                    game.tasks.append(new_task)
                    next_player.current_tasks.append(new_task)
            
            # 设置下一个玩家的状态为活动状态
            if next_player.current_tasks:  # 只有在实际有任务时才设置状态
                next_player.status = PlayerStatus.ACTIVE
                next_player.current_batch = completed_batch
                if completed_batch not in next_player.batch_start_time:
                    next_player.batch_start_time[completed_batch] = int(time.time() * 1000)
                print(f"Activated player {next_player.name} for batch {completed_batch}")
        
        # 2. 如果是最后一个玩家且还有下一个批次，需要等待第一个玩家完成当前批次
        if is_last_player and completed_batch < game.max_batches:
            next_batch = completed_batch + 1
            game.current_batch = next_batch
            
            # 检查第一个玩家是否已完成当前批次
            first_player = game.players[0]
            first_player_current_batch_tasks = [t for t in game.tasks 
                                              if t.batch_number == completed_batch 
                                              and t.assigned_to == first_player.id]
            
            if all(t.status == TaskStatus.COMPLETED for t in first_player_current_batch_tasks):
                # 分配新批次的任务给第一个玩家
                first_player.status = PlayerStatus.ACTIVE
                first_player.current_batch = next_batch
                first_player.batch_start_time[next_batch] = int(time.time() * 1000)
                
                # 按子批次结构分配新任务
                sub_batch_structure = self.batch_structure[next_batch]
                for sub_batch_idx, coins_count in sub_batch_structure:
                    task_type = random.choice(list(TaskType))  # 为新批次随机选择任务类型
                    for _ in range(coins_count):
                        task = Task(
                            id=str(uuid.uuid4()),
                            type=task_type,
                            description=f"Flip coin to {task_type} (Round {next_batch}, Sub-batch {sub_batch_idx + 1})",
                            batch_number=next_batch,
                            sub_batch_number=sub_batch_idx,
                            status=TaskStatus.PENDING,
                            assigned_to=first_player.id
                        )
                        game.tasks.append(task)
                        first_player.current_tasks.append(task)
                
                print(f"Started new batch {next_batch} for first player with proper sub-batch structure")
            else:
                print(f"Waiting for first player to complete batch {completed_batch}")
        
        # 3. 当前玩家进入等待状态
        player.status = PlayerStatus.WAITING
        player.current_tasks = []
        
        return True

    def complete_task(self, game_id: str, player_id: str, task_id: str) -> bool:
        """Complete a task and handle batch completion if needed"""
        if game_id not in self.games:
            return False
        
        game = self.games[game_id]
        player = next((p for p in game.players if p.id == player_id), None)
        if not player:
            print(f"Player {player_id} not found")
            return False

        task = next((t for t in game.tasks if t.id == task_id and t.assigned_to == player_id), None)
        if not task:
            print(f"Task {task_id} not found in player's tasks")
            return False

        print(f"Player {player.name} completing task {task.id} in batch {task.batch_number}, sub-batch {task.sub_batch_number}")
        
        # 完成任务
        task.status = TaskStatus.COMPLETED
        if task in player.current_tasks:
            player.current_tasks.remove(task)
        player.completed_tasks.append(task)

        # 检查该子批次是否完成
        sub_batch_tasks = [t for t in game.tasks 
                          if t.batch_number == task.batch_number 
                          and t.sub_batch_number == task.sub_batch_number
                          and t.assigned_to == player_id]
        
        completed_sub_batch_tasks = [t for t in sub_batch_tasks if t.status == TaskStatus.COMPLETED]
        print(f"Completed tasks in sub-batch {task.sub_batch_number}: {len(completed_sub_batch_tasks)}/{len(sub_batch_tasks)}")
        
        # 如果子批次完成，立即传递给下一个玩家
        if len(completed_sub_batch_tasks) == len(sub_batch_tasks):
            print(f"Sub-batch {task.sub_batch_number} of batch {task.batch_number} completed")
            
            # 检查是否是最后一个玩家
            is_last_player = player.order == len(game.players) - 1
            
            if not is_last_player:
                # 立即将完成的子批次传递给下一个玩家
                next_player = game.players[player.order + 1]
                
                # 检查下一个玩家是否已经有这个子批次的任务
                existing_tasks = [t for t in game.tasks 
                                if t.batch_number == task.batch_number 
                                and t.sub_batch_number == task.sub_batch_number
                                and t.assigned_to == next_player.id]
                
                if not existing_tasks:
                    print(f"Passing sub-batch {task.sub_batch_number} to {next_player.name}")
                    # 为该子批次创建新任务
                    for completed_task in completed_sub_batch_tasks:
                        new_task = self._clone_task(completed_task)
                        new_task.assigned_to = next_player.id
                        game.tasks.append(new_task)
                        next_player.current_tasks.append(new_task)
                    
                    # 设置下一个玩家为活动状态（如果还没有激活）
                    if next_player.status != PlayerStatus.ACTIVE:
                        next_player.status = PlayerStatus.ACTIVE
                        next_player.current_batch = task.batch_number
                        if task.batch_number not in next_player.batch_start_time:
                            next_player.batch_start_time[task.batch_number] = int(time.time() * 1000)
                        print(f"Activated player {next_player.name} for batch {task.batch_number}")
            
            # 检查当前玩家的所有子批次是否都完成
            all_batch_tasks = [t for t in game.tasks 
                             if t.batch_number == task.batch_number 
                             and t.assigned_to == player_id]
            
            if all(t.status == TaskStatus.COMPLETED for t in all_batch_tasks):
                print(f"Player {player.name} completed all sub-batches in batch {task.batch_number}")
                # 如果所有子批次都完成，调用批次完成处理
                self._handle_batch_completion(game, player, task.batch_number)
            else:
                print(f"Player {player.name} still has incomplete sub-batches in batch {task.batch_number}")
        
        return True

    def get_game_state(self, game_id: str) -> Optional[Game]:
        return self.games.get(game_id)

    def flip_coin(self, game_id: str, task_id: str) -> bool:
        """Flip a coin (task) in the game"""
        if game_id not in self.games:
            return False
        
        game = self.games[game_id]
        
        # 首先找到要翻转的任务
        task_to_flip = next((t for t in game.tasks if t.id == task_id), None)
        if not task_to_flip:
            print(f"Task {task_id} not found")
            return False
        
        # 找到当前活跃的玩家
        current_player = next((p for p in game.players if p.status == PlayerStatus.ACTIVE), None)
        if not current_player:
            print("No active player found")
            return False
        
        # 检查任务是否属于当前玩家
        if task_to_flip.assigned_to != current_player.id:
            print(f"Task {task_id} is not assigned to the current player")
            return False
        
        # 检查任务是否属于当前批次
        if task_to_flip.batch_number != current_player.current_batch:
            print(f"Task {task_id} is not in the current batch")
            return False
        
        # 检查任务是否处于待完成状态
        if task_to_flip.status != TaskStatus.PENDING:
            print(f"Task {task_id} is not in pending status")
            return False
        
        # 使用complete_task来处理任务完成
        return self.complete_task(game_id, current_player.id, task_id)

    def _get_batch_size(self, batch_number: int) -> int:
        """获取指定批次需要完成的任务数量"""
        batch_sizes = {
            1: 20,  # 第一轮需要翻转20个
            2: 20,  # 第二轮需要翻转20个
            3: 20,   # 第三轮需要翻转20个
            4: 20    # 第四轮需要翻转20个
        }
        return batch_sizes.get(batch_number, 0)

    def _clone_task(self, task: Task) -> Task:
        """Create a new instance of a task with reset status"""
        return Task(
            id=str(uuid.uuid4()),
            type=task.type,
            description=task.description,
            batch_number=task.batch_number,
            sub_batch_number=task.sub_batch_number,  # 保持子批次信息
            status=TaskStatus.PENDING
        ) 