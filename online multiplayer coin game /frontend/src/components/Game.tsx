import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Typography,
    Grid,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    Alert,
    Chip,
    keyframes,
    Stack,
    TableContainer,
    Table,
    TableHead,
    TableBody,
    TableCell,
    TableRow,
    Paper,
    Container,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemText
} from '@mui/material';
import { Game as GameType, Player, Task, TaskStatus, PlayerStatus, TaskType } from '../types';
import { gameService, WebSocketService } from '../services/gameService';
import HelpIcon from '@mui/icons-material/Help';

interface GameProps {
    gameId?: string;
}

type TabType = 0 | 1;

// 添加类型定义
interface BatchTimes {
    [key: number]: {
        [key: string]: number;
    };
}

export const Game: React.FC<GameProps> = ({ gameId: initialGameId }) => {
    const [gameId, setGameId] = useState<string | undefined>(initialGameId);
    const [game, setGame] = useState<GameType | null>(null);
    const [playerName, setPlayerName] = useState('');
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [wsService, setWsService] = useState<WebSocketService | null>(null);
    const [showJoinDialog, setShowJoinDialog] = useState(!initialGameId);
    const [playerCount, setPlayerCount] = useState(2);
    const [maxBatches, setMaxBatches] = useState(3);
    const [coinsPerBatch, setCoinsPerBatch] = useState(20);
    const [joinGameId, setJoinGameId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [showCompletionDialog, setShowCompletionDialog] = useState(false);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [showResultPage, setShowResultPage] = useState(false);
    const [batchCompletionTimes, setBatchCompletionTimes] = useState<{[key: number]: {[key: string]: number}}>({});
    const [batchStartTimes, setBatchStartTimes] = useState<BatchTimes>({});

    const [batchFlipStates, setBatchFlipStates] = useState<{
        [batchNum: number]: {
            [taskId: string]: boolean;  // true means flipped
        };
    }>({});

    const [flipCoins, setFlipCoins] = useState<string[]>([]);
    const syncFlippedCoins = (taskId: string) => {
        if (!flipCoins.includes(taskId)) {
            setFlipCoins(prev => [...prev, taskId]);
        }
    };

    // 修改翻转状态的类型定义，加入玩家ID
    const [flippedCoins, setFlippedCoins] = useState<{[playerId: string]: string[]}>({});
    const [pendingBatchCompletion, setPendingBatchCompletion] = useState<{
        [batchNum: number]: string[];
    }>({});

    // 添加翻转动画状态
    interface FlipState {
        isFlipping: boolean;
        showOpposite: boolean;
    }
    const [flipStates, setFlipStates] = useState<{
        [key: string]: FlipState;
    }>({});

    // 添加翻转动画状态
    const [flippingCoins, setFlippingCoins] = useState<{[key: string]: { isFlipping: boolean }}>({});

    // 修改计时器状态和开始时间状态
    const [elapsedTime, setElapsedTime] = useState<number>(0);

    // 添加批次统计时间的状态
    const [batchStats, setBatchStats] = useState<{
        [batchNum: number]: {
            [playerId: string]: {
                completionTime: number;
                tasksCompleted: number;
                totalTasks: number;
            }
        }
    }>({});

    // 添加当前子批次的useEffect
    const [currentSubBatch, setCurrentSubBatch] = useState<number>(0);

    // 添加已完成子批次的状态
    const [completedSubBatches, setCompletedSubBatches] = useState<Set<string>>(new Set());

    // 添加永久翻转状态的记录
    const [permanentFlippedCoins, setPermanentFlippedCoins] = useState<{[playerId: string]: string[]}>({});

    const [showHelpDialog, setShowHelpDialog] = useState(false);

    // 添加一个新的state来跟踪每个批次的累计时间
    const [batchElapsedTimes, setBatchElapsedTimes] = useState<BatchTimes>({});

    useEffect(() => {
        if (gameId && playerId) {
            const service = new WebSocketService(gameId, playerId, (updatedGame) => {
                console.log('Game state updated:', updatedGame);
                setGame(updatedGame);
            }, syncFlippedCoins);
            service.connect();
            setWsService(service);

            // Cleanup function
            return () => {
                service.disconnect();
            };
        }
    }, [gameId, playerId]);

    useEffect(() => {
        if (game?.status === 'in_progress' && !startTime) {
            setStartTime(Date.now());
        }
    }, [game?.status, startTime]);

    useEffect(() => {
        let timerInterval: NodeJS.Timeout | null = null;
        
        if (game?.status === 'in_progress' && playerId) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (currentPlayer?.status === PlayerStatus.ACTIVE) {
                const currentBatch = currentPlayer.current_batch;
                const currentTime = Date.now();
                
                // 确保有开始时间
                if (!batchStartTimes[currentBatch]?.[currentBatch]) {
                    setBatchStartTimes(prev => ({
                        ...prev,
                        [currentBatch]: {
                            ...(prev[currentBatch] || {}),
                            [currentBatch]: currentTime
                        }
                    }));
                }

                timerInterval = setInterval(() => {
                    const batchStartTime = (batchStartTimes[currentBatch] || {})[currentBatch];
                    if (batchStartTime) {
                        const previousTime = (batchElapsedTimes[currentBatch] || {})[playerId] || 0;
                        const newElapsed = Date.now() - batchStartTime + previousTime;
                        setCurrentTime(newElapsed);
                    }
                }, 1000);
            }
        }

        if (game?.status === 'completed' && startTime && !endTime) {
            setEndTime(Date.now());
            setShowResultPage(true);
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        }

        return () => {
            if (timerInterval) {
                clearInterval(timerInterval);
            }
        };
    }, [game?.status, game?.players, playerId, batchStartTimes, batchElapsedTimes]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        
        if (startTime && game?.status === 'in_progress') {
            intervalId = setInterval(() => {
                setElapsedTime(prev => Date.now() - startTime);
            }, 1000);
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [startTime, game?.status]);

    useEffect(() => {
        if (game?.tasks && game.players) {
            const newStartTimes = { ...batchStartTimes };
            const newCompletionTimes = { ...batchCompletionTimes };
            let hasChanges = false;

            game.players.forEach(player => {
                // 获取玩家当前批次的所有任务
                const currentBatchTasks = game.tasks.filter(t => 
                    t.batch_number === player.current_batch && 
                    t.assigned_to === player.id
                );

                // 检查是否有新的子批次任务（所有任务都是PENDING状态）
                if (currentBatchTasks.length > 0 && 
                    currentBatchTasks.every(t => t.status === TaskStatus.PENDING)) {
                    const currentTime = Date.now();
                    if (!newStartTimes[player.current_batch]) {
                        newStartTimes[player.current_batch] = {};
                    }
                    // 更新开始时间，确保计时器继续
                    newStartTimes[player.current_batch][player.current_batch] = currentTime;
                    hasChanges = true;
                    // 更新全局startTime
                    setStartTime(currentTime);
                }

                // 处理批次完成时间
                if (currentBatchTasks.length > 0 && 
                    currentBatchTasks.every(t => t.status === TaskStatus.COMPLETED) &&
                    !newCompletionTimes[player.current_batch]?.[player.id]) {
                    if (!newCompletionTimes[player.current_batch]) {
                        newCompletionTimes[player.current_batch] = {};
                    }
                    const batchStartTime = newStartTimes[player.current_batch]?.[player.current_batch];
                    if (batchStartTime) {
                        newCompletionTimes[player.current_batch][player.id] = Date.now() - batchStartTime;
                        hasChanges = true;
                    }
                }
            });

            if (hasChanges) {
                setBatchStartTimes(newStartTimes);
                setBatchCompletionTimes(newCompletionTimes);
            }
        }
    }, [game?.tasks, game?.players]);

    // 添加一个新的useEffect来监听游戏状态变化
    useEffect(() => {
        if (game?.status === 'in_progress' && playerId) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (currentPlayer) {
                const currentBatchTasks = game.tasks.filter(t => 
                    t.batch_number === currentPlayer.current_batch && 
                    t.assigned_to === playerId
                );
                
                // 如果玩家有新的PENDING任务，确保计时器在运行
                if (currentBatchTasks.length > 0 && 
                    currentBatchTasks.every(t => t.status === TaskStatus.PENDING)) {
                    const currentTime = Date.now();
                    setStartTime(currentTime);
                }
            }
        }
    }, [game?.status, game?.tasks, game?.players, playerId]);

    useEffect(() => {
        if (game?.tasks) {
            let shouldUpdate = false;
            const newFlippedCoins: {[playerId: string]: string[]} = {...flippedCoins};

            // 检查是否有新的批次开始
            game.players.forEach(player => {
                const playerTasks = game.tasks.filter(t => t.assigned_to === player.id);
                const currentBatchTasks = playerTasks.filter(t => t.batch_number === player.current_batch);
                
                // 如果有新的批次任务，且都是PENDING状态，说明是新批次开始
                if (currentBatchTasks.length > 0 && 
                    currentBatchTasks.every(t => t.status === TaskStatus.PENDING)) {
                    // 清理上一个批次的翻转状态
                    const prevBatchTasks = playerTasks.filter(t => t.batch_number === player.current_batch - 1);
                    const prevBatchTaskIds = prevBatchTasks.map(t => t.id);
                    if (newFlippedCoins[player.id]) {
                        newFlippedCoins[player.id] = newFlippedCoins[player.id].filter(id => !prevBatchTaskIds.includes(id));
                        shouldUpdate = true;
                    }
                }
            });

            // 只在有变化时更新状态
            if (shouldUpdate) {
                setFlippedCoins(newFlippedCoins);
            }
        }
    }, [game?.tasks]);

    // 修改游戏状态更新的effect，确保永久翻转的硬币不会被重置
    useEffect(() => {
        if (game?.tasks && playerId) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (!currentPlayer) return;

            const playerTasks = game.tasks.filter(t => t.assigned_to === playerId);
            const currentBatchTasks = playerTasks.filter(t => t.batch_number === currentPlayer.current_batch);
            
            const shouldUpdateFlips = currentBatchTasks.some(t => t.status === TaskStatus.COMPLETED) ||
                currentBatchTasks.every(t => t.status === TaskStatus.PENDING);

            if (shouldUpdateFlips) {
                setFlippedCoins(prev => {
                    const otherPlayersStates = { ...prev };
                    const permanentFlips = permanentFlippedCoins[playerId] || [];
                    const completedTaskIds = playerTasks
                        .filter(t => t.status === TaskStatus.COMPLETED)
                        .map(t => t.id);
                    
                    // 使用Array.from替代Set的扩展运算符
                    const allFlippedCoins = Array.from(new Set([...permanentFlips, ...completedTaskIds]));
                    
                    return {
                        ...otherPlayersStates,
                        [playerId]: allFlippedCoins
                    };
                });
            }
        }
    }, [game?.tasks, playerId, permanentFlippedCoins]);

    // 修改handleCoinFlip函数，记录永久翻转状态
    const handleCoinFlip = (taskId: string) => {
        if (!playerId) return;
        
        // 立即更新当前玩家的翻转状态
        setFlippedCoins(prev => {
            const currentPlayerFlips = prev[playerId] || [];
            if (!currentPlayerFlips.includes(taskId)) {
                // 同时更新永久翻转状态
                setPermanentFlippedCoins(prevPermanent => ({
                    ...prevPermanent,
                    [playerId]: [...(prevPermanent[playerId] || []), taskId]
                }));
                
                return {
                    ...prev,
                    [playerId]: [...currentPlayerFlips, taskId]
                };
            }
            return prev;
        });
        gameService.syncFlipCoin(gameId || '', taskId);
        // 设置翻转动画
        setFlippingCoins(prev => ({
            ...prev,
            [taskId]: { isFlipping: true }
        }));

        setTimeout(() => {
            setFlippingCoins(prev => ({
                ...prev,
                [taskId]: { isFlipping: false }
            }));
        }, 500);
    };

    // 处理批次完成
    const handleCompleteBatch = (batchNum: number) => {
        const pendingTasks = pendingBatchCompletion[batchNum] || [];
        if (pendingTasks.length === 0) return;

        // 发送所有任务完成的请求
        pendingTasks.forEach((taskId: string) => {
            if (wsService) {
                wsService.completeTask(taskId);
            }
        });

        // 清理这个批次的待完成状态
        setPendingBatchCompletion((prev: {[batchNum: number]: string[]}) => {
            const newState = { ...prev };
            delete newState[batchNum];
            return newState;
        });
    };

    // 修改渲染硬币的函数
    const renderCoin = (type: TaskType, isFlipping: boolean, isSmall: boolean = false, onClick?: () => void, taskId?: string) => {
        if (!taskId) return null;
        const flipState = taskId ? flippingCoins[taskId] : undefined;
        const isFlipped = taskId && playerId && flippedCoins[playerId] ? flippedCoins[playerId].includes(taskId) : false;
        
        // 决定显示哪一面
        let displayType = isFlipped
            ? (type === TaskType.HEADS ? TaskType.TAILS : TaskType.HEADS) 
            : type;
        if (flipCoins.includes(taskId))
            displayType = TaskType.HEADS;
        else
            displayType = TaskType.TAILS;
        return (
            <Box
                sx={{
                    width: isSmall ? 20 : 32,
                    height: isSmall ? 20 : 32,
                    borderRadius: '50%',
                    backgroundColor: displayType === TaskType.HEADS ? '#FFD700' : '#DAA520',
                    border: `${isSmall ? 1 : 2}px solid #B8860B`,
                    color: '#704214',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: isSmall ? '0.6rem' : '0.8rem',
                    perspective: 1000,
                    mb: isSmall ? 0 : 1,
                    position: 'relative',
                    cursor: onClick ? 'pointer' : 'default',
                    transition: 'transform 0.6s',
                    transformStyle: 'preserve-3d',
                    transform: flipState?.isFlipping ? 'rotateY(360deg)' : 'rotateY(0deg)',
                    '&:hover': onClick ? {
                        transform: 'scale(1.05)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    } : {},
                    '&:active': onClick ? {
                        transform: 'scale(0.95)'
                    } : {},
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%)',
                        pointerEvents: 'none'
                    }
                }}
                onClick={onClick}
            >
                {displayType === TaskType.HEADS ? 'H' : 'T'}
            </Box>
        );
    };

    // 监听游戏状态变化
    useEffect(() => {
        if (game?.tasks && playerId) {
            const currentPlayer = game.players.find(p => p.id === playerId);
            if (!currentPlayer) return;

            const playerTasks = game.tasks.filter(t => t.assigned_to === playerId);
            const currentBatchTasks = playerTasks.filter(t => t.batch_number === currentPlayer.current_batch);
            
            // 只有当前玩家的新批次开始时才清理状态
            if (currentBatchTasks.length > 0 && 
                currentBatchTasks.every(t => t.status === TaskStatus.PENDING)) {
                // 清理当前玩家上一个批次的翻转状态
                const prevBatchTasks = playerTasks.filter(t => t.batch_number === currentPlayer.current_batch - 1);
                const prevBatchTaskIds = prevBatchTasks.map(t => t.id);
                setFlippedCoins(prev => ({
                    ...prev,
                    [playerId]: prev[playerId]?.filter(id => !prevBatchTaskIds.includes(id)) || []
                }));
            }
        }
    }, [game?.tasks, playerId]);

    // 检查当前批次是否可以执行
    const canExecuteBatch = (batchNum: number, subBatchIndex: number): boolean => {
        if (!game || !playerId) return false;

        // 获取当前玩家的所有任务
        const playerTasks = game.tasks.filter(t => t.assigned_to === playerId);
        
        // 获取所有之前的子批次
        const previousSubBatches = playerTasks.filter(t => 
            (t.batch_number < batchNum) || 
            (t.batch_number === batchNum && t.sub_batch_number < subBatchIndex)
        );

        // 如果还有之前的子批次未完成，则不能执行当前批次
        return !previousSubBatches.some(t => t.status !== TaskStatus.COMPLETED);
    };

    // 修改renderTaskRow函数中的按钮显示逻辑
    const renderTaskRow = (tasks: Task[], batchNum: number, playerStatus: PlayerStatus) => {
        if (playerStatus === PlayerStatus.WAITING) {
            return (
                <Typography variant="body2" color="text.secondary">
                    Waiting for your turn...
                </Typography>
            );
        }

        const structure = getBatchStructure(batchNum);
        const currentPlayer = game?.players.find(p => p.id === playerId);
        
        return (
            <Box>
                {structure.map(({ subBatchIndex, coinsCount }) => {
                    const subBatchTasks = tasks.filter(t => t.sub_batch_number === subBatchIndex);
                    if (subBatchTasks.length === 0) return null;

                    const currentBatchTarget = subBatchTasks[0]?.type || TaskType.HEADS;
                    const flippedCount = playerId && flippedCoins[playerId] 
                        ? subBatchTasks.filter(t => flippedCoins[playerId].includes(t.id)).length 
                        : 0;
                    const isComplete = isSubBatchComplete(batchNum, subBatchIndex, currentPlayer?.id || '');
                    const canExecute = canExecuteBatch(batchNum, subBatchIndex);
                    
                    // 检查是否是当前活动的子批次
                    const isActiveSubBatch = currentPlayer?.status === PlayerStatus.ACTIVE && 
                                           canExecute && 
                                           !isComplete;

                    // 检查子批次是否已经完成并提交
                    const isSubmitted = subBatchTasks.every(t => t.status === TaskStatus.COMPLETED);
                    // 使用包含玩家ID的buttonKey确保按钮状态的独立性
                    const buttonKey = `${playerId}-${batchNum}-${subBatchIndex}`;
                    const isButtonDisabled = completedSubBatches.has(buttonKey);

                    return (
                        <Box key={buttonKey} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                {isComplete && currentPlayer?.status === PlayerStatus.ACTIVE && !isSubmitted && !isButtonDisabled && (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        size="small"
                                        onClick={() => handleCompleteSubBatch(batchNum, subBatchIndex)}
                                        disabled={!canExecute}
                                    >
                                        Complete this batch
                                    </Button>
                                )}
                            </Box>
                            <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 1,
                                opacity: isActiveSubBatch ? 1 : 0.5,
                                pointerEvents: isActiveSubBatch ? 'auto' : 'none'
                            }}>
                                {subBatchTasks.map((task) => (
                                    <Box key={task.id}>
                                        {renderCoin(
                                            task.type,
                                            flippingCoins[task.id]?.isFlipping || false,
                                            false,
                                            isActiveSubBatch ? () => handleCoinFlip(task.id) : undefined,
                                            task.id
                                        )}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        );
    };

    // 渲染玩家卡片
    const renderPlayer = (player: Player) => {
        const currentBatchTasks = game?.tasks.filter(t => 
            t.batch_number === player.current_batch && 
            t.assigned_to === player.id
        ) || [];

        const currentBatchTarget = currentBatchTasks[0]?.type;
        const requiredCoins = getRequiredCoinsForBatch(player.current_batch);
        const currentFlippedCount = currentBatchTasks.filter(t => flippedCoins[player.id]?.includes(t.id)).length;

        return (
            <Card key={player.id} sx={{ mb: 2 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">
                            {player.name}
                        </Typography>
                        <Chip 
                            label={player.status}
                            color={player.status === PlayerStatus.ACTIVE ? "success" : "default"}
                            size="small"
                        />
                    </Box>

                    <Box sx={{ mb: 2, bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Current Round: {player.current_batch} / {game?.max_batches}
                            {currentBatchTarget && player.status === PlayerStatus.ACTIVE && (
                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                    <Typography variant="body2" sx={{ mr: 1 }}>
                                        Required flips:
                                    </Typography>
                                    <Typography variant="body2" sx={{ ml: 2 }}>
                                        {requiredCoins}
                                    </Typography>
                                </Box>
                            )}
                        </Typography>

                        <Box sx={{ mb: 2 }}>
                            {renderTaskRow(currentBatchTasks, player.current_batch, player.status)}
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    const getPlayerStatusColor = (status: PlayerStatus) => {
        switch (status) {
            case PlayerStatus.ACTIVE:
                return 'success';
            case PlayerStatus.WAITING:
                return 'warning';
            case PlayerStatus.IDLE:
                return 'default';
            default:
                return 'default';
        }
    };

    const getTaskStatusColor = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.COMPLETED:
                return '#4caf50';
            case TaskStatus.IN_PROGRESS:
                return '#ff9800';
            case TaskStatus.PENDING:
                return '#9e9e9e';
            default:
                return '#9e9e9e';
        }
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        // Reset all fields when switching tabs
        setActiveTab(newValue as TabType);
        setPlayerName('');
        setPlayerCount(2);
        setMaxBatches(3);
        setCoinsPerBatch(20);
        setJoinGameId('');
        setError(null);
    };

    const handleGameComplete = () => {
        setEndTime(Date.now());
        setShowCompletionDialog(true);
    };

    // 添加一个辅助函数来处理毫秒到时间的转换
    const formatTimeFromMs = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const renderCompletionDialog = () => {
        if (!startTime || !endTime) return null;
        const totalTime = endTime - startTime;

        return (
            <Dialog 
                open={showCompletionDialog} 
                onClose={() => setShowCompletionDialog(false)}
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        p: 2
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center', color: 'primary.main' }}>
                    Game Completed!
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center',
                        gap: 2,
                        py: 2
                    }}>
                        <Typography variant="h6">
                            Total Time: {formatTimeFromMs(endTime - startTime)}
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            All players have successfully completed their tasks!
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center' }}>
                    <Button 
                        variant="contained" 
                        onClick={() => {
                            setShowCompletionDialog(false);
                            window.location.reload(); // Reset the game
                        }}
                    >
                        Start New Game
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    const handleCompleteGame = () => {
        setShowResultPage(true);
    };

    // 修改返回主菜单的处理函数
    const handleReturnToMainMenu = () => {
        // 清除游戏状态
        setGameId('');
        setGame(null);
        setWsService(null);
        setStartTime(null);
        setEndTime(null);
        // 清除输入记录
        setPlayerName('');
        setPlayerCount(2);
        setJoinGameId('');
        setError(null);
    };

    const renderResultPage = () => {
        if (!startTime || !endTime) return null;
        const totalTime = endTime - startTime;

        return (
            <Box sx={{ 
                p: 3, 
                backgroundColor: 'background.default', 
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Card sx={{ 
                    maxWidth: 600, 
                    width: '100%',
                    p: 4,
                    textAlign: 'center'
                }}>
                    <Typography variant="h4" sx={{ mb: 3, color: 'primary.main' }}>
                        Game Complete! 🎉
                    </Typography>
                    <Typography variant="h5" sx={{ mb: 4 }}>
                        Total Time: {formatTimeFromMs(totalTime)}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleReturnToMainMenu}
                        size="large"
                    >
                        Return to Main Menu
                    </Button>
                </Card>
            </Box>
        );
    };

    const renderStatistics = () => {
        if (!game) return null;

        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                    Game Statistics
                </Typography>
                {Array.from({ length: game.max_batches }, (_, i) => i + 1).map(batchNum => (
                    <Box key={batchNum} sx={{ mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                            Round {batchNum}
                        </Typography>
                        <TableContainer component={Paper} sx={{ mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Player</TableCell>
                                        <TableCell align="right">Time</TableCell>
                                        <TableCell align="right">Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {game.players.map(player => {
                                        const batchTasks = game.tasks.filter(t => 
                                            t.batch_number === batchNum && 
                                            t.assigned_to === player.id
                                        );
                                        const isCompleted = batchTasks.length > 0 && batchTasks.every(t => t.status === TaskStatus.COMPLETED);
                                        const hasStarted = player.batch_start_time?.[batchNum] != null;
                                        const completionTime = player.batch_completion_time?.[batchNum];
                                        const startTime = player.batch_start_time?.[batchNum];
                                        
                                        // 计算当前时间（如果批次已开始但未完成）
                                        let displayTime = '-';
                                        if (completionTime) {
                                            displayTime = formatTimeFromMs(completionTime);
                                        } else if (hasStarted && startTime) {
                                            const currentTime = Date.now() - startTime;
                                            displayTime = formatTimeFromMs(currentTime);
                                        }

                                        let status = 'Pending';
                                        if (isCompleted) {
                                            status = 'Completed';
                                        } else if (hasStarted) {
                                            status = 'In Progress';
                                        }

                                        return (
                                            <TableRow key={player.id}>
                                                <TableCell>{player.name}</TableCell>
                                                <TableCell align="right">{displayTime}</TableCell>
                                                <TableCell align="right">
                                                    <Chip 
                                                        label={status}
                                                        size="small"
                                                        color={isCompleted ? 'success' : (hasStarted ? 'primary' : 'default')}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    <TableRow sx={{ backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
                                        <TableCell><strong>Total</strong></TableCell>
                                        <TableCell align="right">
                                            <strong>
                                                {formatTimeFromMs(game.players.reduce((sum, p) => 
                                                    sum + (p.batch_completion_time?.[batchNum] || 0), 
                                                    0
                                                ))}
                                            </strong>
                                        </TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                ))}
            </Box>
        );
    };

    // 使用useMemo来记忆计算结果
    const getTasksForBatch = React.useMemo(() => {
        if (!game?.tasks) return {};
        const tasksByBatch: { [key: number]: Task[] } = {};
        game.tasks.forEach(task => {
            if (!tasksByBatch[task.batch_number]) {
                tasksByBatch[task.batch_number] = [];
            }
            tasksByBatch[task.batch_number].push(task);
        });
        return tasksByBatch;
    }, [game?.tasks]);

    // 使用useMemo来记忆玩家任务
    const getPlayerTasks = React.useMemo(() => {
        if (!game?.tasks || !game?.players) return {};
        const playerTasks: { [key: string]: Task[] } = {};
        game.players.forEach(player => {
            playerTasks[player.id] = game.tasks.filter(t => t.assigned_to === player.id);
        });
        return playerTasks;
    }, [game?.tasks, game?.players]);

    useEffect(() => {
        if (!game?.tasks || !startTime) return;

        const newStats = { ...batchStats };
        
        // 遍历每个批次
        for (let batchNum = 1; batchNum <= (game.max_batches || 0); batchNum++) {
            if (!newStats[batchNum]) {
                newStats[batchNum] = {};
            }
            
            // 遍历每个玩家
            game.players.forEach(player => {
                const batchTasks = game.tasks.filter(t => 
                    t.batch_number === batchNum && 
                    t.assigned_to === player.id
                );
                
                const completedTasks = batchTasks.filter(t => 
                    t.status === TaskStatus.COMPLETED
                );
                
                // 如果这个批次的所有任务都完成了，记录完成时间
                if (batchTasks.length > 0 && completedTasks.length === batchTasks.length) {
                    // 只在第一次完成时记录时间
                    if (!newStats[batchNum][player.id]) {
                        newStats[batchNum][player.id] = {
                            completionTime: elapsedTime,
                            tasksCompleted: completedTasks.length,
                            totalTasks: batchTasks.length
                        };
                    }
                } else if (batchTasks.length > 0) {
                    // 更新进行中的任务状态
                    newStats[batchNum][player.id] = {
                        completionTime: 0,
                        tasksCompleted: completedTasks.length,
                        totalTasks: batchTasks.length
                    };
                }
            });
        }
        
        setBatchStats(newStats);
    }, [game?.tasks, startTime, elapsedTime]);

    useEffect(() => {
        if (!game?.tasks || !startTime) return;

        const newCompletionTimes = { ...batchCompletionTimes };
        const newStartTimes = { ...batchStartTimes };
        let hasChanges = false;

        Object.entries(getTasksForBatch).forEach(([batchNum, tasks]) => {
            const batchNumber = parseInt(batchNum);
            if (!newStartTimes[batchNumber]) {
                newStartTimes[batchNumber] = {};
                hasChanges = true;
            }
            if (!newCompletionTimes[batchNumber]) {
                newCompletionTimes[batchNumber] = {};
                hasChanges = true;
            }

            game.players.forEach(player => {
                const playerTasks = tasks.filter(t => t.assigned_to === player.id);
                if (playerTasks.length > 0 && 
                    playerTasks.every(t => t.status === TaskStatus.COMPLETED) && 
                    !newCompletionTimes[batchNumber][player.id]) {
                    const batchStartTime = newStartTimes[batchNumber]?.[batchNumber];
                    newCompletionTimes[batchNumber][player.id] = Date.now() - batchStartTime;
                    hasChanges = true;
                }
            });
        });

        // 只在有变化时更新状态
        if (hasChanges) {
            setBatchStartTimes(newStartTimes);
            setBatchCompletionTimes(newCompletionTimes);
        }
    }, [game?.players, getTasksForBatch, startTime]);

    useEffect(() => {
        if (game?.tasks && startTime) {
            const newStats = { ...batchStats };
            
            // 遍历每个批次
            for (let batchNum = 1; batchNum <= (game.max_batches || 0); batchNum++) {
                if (!newStats[batchNum]) {
                    newStats[batchNum] = {};
                }
                
                // 遍历每个玩家
                game.players.forEach(player => {
                    const batchTasks = game.tasks.filter(t => 
                        t.batch_number === batchNum && 
                        t.assigned_to === player.id
                    );
                    
                    const completedTasks = batchTasks.filter(t => 
                        t.status === TaskStatus.COMPLETED
                    );
                    
                    // 如果这个批次的所有任务都完成了，记录完成时间
                    if (batchTasks.length > 0 && completedTasks.length === batchTasks.length) {
                        // 只在第一次完成时记录时间
                        if (!newStats[batchNum][player.id]) {
                            newStats[batchNum][player.id] = {
                                completionTime: elapsedTime,
                                tasksCompleted: completedTasks.length,
                                totalTasks: batchTasks.length
                            };
                        }
                    } else if (batchTasks.length > 0) {
                        // 更新进行中的任务状态
                        newStats[batchNum][player.id] = {
                            completionTime: 0,
                            tasksCompleted: completedTasks.length,
                            totalTasks: batchTasks.length
                        };
                    }
                });
            }
            
            setBatchStats(newStats);
        }
    }, [game?.tasks, startTime, elapsedTime]);

    // 修改统计页面中的完成时间显示
    const renderBatchStatistics = (batchNum: number, player: Player) => {
        const stats = batchStats[batchNum]?.[player.id];
        
        return (
            <TableRow key={player.id}>
                <TableCell>{player.name}</TableCell>
                <TableCell align="right">
                    {stats?.completionTime ? formatTimeFromMs(stats.completionTime) : '-'}
                </TableCell>
                <TableCell align="right">
                    {stats?.tasksCompleted}/{stats?.totalTasks || 0}
                </TableCell>
            </TableRow>
        );
    };

    // 渲染主菜单
    const renderMainMenu = () => (
        <Card sx={{
            maxWidth: 600,
            width: '100%',
            mx: 'auto',
            mt: 4
        }}>
            {/* Top section with title and subtitle */}
            <Box sx={{
                background: 'linear-gradient(180deg, #f5f9ff 0%, #e8f3ff 100%)',
                p: 4,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                position: 'relative'
            }}>
                <IconButton
                    onClick={() => setShowHelpDialog(true)}
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        color: 'primary.main'
                    }}
                >
                    <HelpIcon />
                </IconButton>
                <Typography variant="h3" sx={{
                    fontWeight: 'bold',
                    background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    mb: 1
                }}>
                    Online Multiplayer Coin Game
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" align="center">
                    Flip coins with your friends in this multiplayer game!
                </Typography>
            </Box>

            {/* Bottom section with form */}
            <Box sx={{
                background: '#ffffff',
                p: 4,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8
            }}>
                <Tabs value={activeTab} onChange={(e, newValue) => {
                    setActiveTab(newValue as TabType);
                    // 切换标签时也清除输入
                    setPlayerName('');
                    setPlayerCount(2);
                    setJoinGameId('');
                    setError(null);
                }} sx={{ mb: 3 }}>
                    <Tab label="CREATE GAME" />
                    <Tab label="JOIN GAME" />
                </Tabs>

                {activeTab === 0 ? (
                    // Create game form
                    <Box component="form" onSubmit={handleCreateGame}>
                        <TextField
                            fullWidth
                            label="Your Name"
                            required
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            sx={{ mb: 2 }}
                            autoComplete="off"
                        />
                        <TextField
                            fullWidth
                            label="Number of Players"
                            type="number"
                            required
                            value={playerCount}
                            onChange={(e) => setPlayerCount(Number(e.target.value))}
                            inputProps={{ min: 2, max: 5 }}
                            helperText="Minimum 2"
                            sx={{ mb: 3 }}
                            autoComplete="off"
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            type="submit"
                            disabled={!playerName || playerCount < 2 || playerCount > 5}
                        >
                            Create Game
                        </Button>
                    </Box>
                ) : (
                    // Join game form
                    <Box component="form" onSubmit={handleJoinGame}>
                        <TextField
                            fullWidth
                            label="Your Name"
                            required
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            sx={{ mb: 2 }}
                            autoComplete="off"
                        />
                        <TextField
                            fullWidth
                            label="Game Code"
                            required
                            value={joinGameId}
                            onChange={(e) => setJoinGameId(e.target.value)}
                            sx={{ mb: 3 }}
                            autoComplete="off"
                        />
                        <Button
                            fullWidth
                            variant="contained"
                            type="submit"
                            disabled={!playerName || !joinGameId}
                        >
                            Join Game
                        </Button>
                    </Box>
                )}
            </Box>
        </Card>
    );

    const renderHelpDialog = () => {
        return (
            <Dialog
                open={showHelpDialog}
                onClose={() => setShowHelpDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Game Instructions
                </DialogTitle>
                <DialogContent>
                    <List>
                        <ListItem>
                            <ListItemText
                                primary="Game Overview"
                                secondary="This is a multiplayer coin flipping game where players take turns flipping coins to complete specific patterns."
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Game Setup"
                                secondary="1. Create a new game or join an existing one using the game code
                                         2. Wait for all players to join
                                         3. The game creator can start the game when everyone is ready"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Gameplay"
                                secondary="1. Each player takes turns flipping coins
                                         2. The goal is to flip coins to match the required pattern
                                         3. Complete all batches to win the game
                                         4. The game tracks completion time for each round"
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemText
                                primary="Controls"
                                secondary="1. Click on coins to flip them
                                         2. Use the 'Complete Batch' button when you've finished a batch
                                         3. The game automatically tracks your progress"
                            />
                        </ListItem>
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowHelpDialog(false)} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        );
    };

    const renderGame = () => {
        if (!game) return null;
        
        return (
            <Box sx={{ p: 3, backgroundColor: 'background.default', minHeight: '100vh' }}>
                {/* 游戏头部信息 */}
                <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 3
                }}>
                    <Box>
                        <Typography variant="h4" sx={{ mb: 1, color: 'primary.main' }}>
                            Game ID: {game.id}
                        </Typography>
                        <Typography variant="h5" sx={{ color: 'text.primary' }}>
                            Status: {game.status === 'waiting' ? 'Waiting' : game.status === 'in_progress' ? 'In Progress' : 'Completed'}
                        </Typography>
                    </Box>
                </Box>

                {/* 开始游戏按钮 */}
                {game.status === 'waiting' && playerId === game.players[0]?.id && (
                    <Button
                        variant="contained"
                        onClick={handleStartGame}
                        sx={{ mb: 3 }}
                    >
                        Start Game
                    </Button>
                )}

                {/* 游戏内容 */}
                <Grid container spacing={3}>
                    {/* Left column: Player cards */}
                    <Grid item xs={12} md={7}>
                        <Stack spacing={3}>
                            {game.players.map(renderPlayer)}
                        </Stack>
                    </Grid>

                    {/* Right column: Results and statistics */}
                    <Grid item xs={12} md={5}>
                        {renderStatistics()}
                    </Grid>
                </Grid>

                {/* 返回主菜单按钮 - 只在游戏完成时显示 */}
                {game.status === 'completed' && (
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Button
                            variant="contained"
                            onClick={handleReturnToMainMenu}
                            sx={{
                                minWidth: 200,
                                borderRadius: 2
                            }}
                        >
                            Return to Main Menu
                        </Button>
                    </Box>
                )}
            </Box>
        );
    };

    // 获取每轮需要翻转的硬币数量
    const getRequiredCoinsForBatch = (batchNum: number): number => {
        return 20; // 所有批次都需要20个硬币
    };

    // 获取每轮的子批次结构
    const getBatchStructure = (batchNum: number): { subBatchIndex: number, coinsCount: number }[] => {
        const structure = {
            1: [{ subBatchIndex: 0, coinsCount: 20 }],  // 第1轮：1个批次×20枚
            2: [  // 第2轮：2个批次×10枚
                { subBatchIndex: 0, coinsCount: 10 },
                { subBatchIndex: 1, coinsCount: 10 }
            ],
            3: [  // 第3轮：4个批次×5枚
                { subBatchIndex: 0, coinsCount: 5 },
                { subBatchIndex: 1, coinsCount: 5 },
                { subBatchIndex: 2, coinsCount: 5 },
                { subBatchIndex: 3, coinsCount: 5 }
            ],
            4: Array.from({ length: 10 }, (_, i) => ({  // 第4轮：10个批次×2枚
                subBatchIndex: i,
                coinsCount: 2
            }))
        };
        return structure[batchNum as keyof typeof structure] || [];
    };

    // 获取当前子批次的硬币数量
    const getSubBatchSize = (batchNum: number, subBatchIndex: number): number => {
        const structure = getBatchStructure(batchNum);
        const subBatch = structure.find(sb => sb.subBatchIndex === subBatchIndex);
        return subBatch?.coinsCount || 0;
    };

    // 修改isSubBatchComplete函数
    const isSubBatchComplete = (batchNum: number, subBatchIndex: number, currentPlayerId: string): boolean => {
        if (!game) return false;
        const subBatchTasks = game.tasks.filter(t => 
            t.batch_number === batchNum && 
            t.sub_batch_number === subBatchIndex &&
            t.assigned_to === currentPlayerId
        );
        const flippedCount = subBatchTasks.filter(t => flippedCoins[currentPlayerId]?.includes(t.id)).length;
        return flippedCount >= getSubBatchSize(batchNum, subBatchIndex);
    };

    // 添加错误处理函数
    const handleGameUpdate = (updatedGame: GameType) => {
        setGame(updatedGame);
        if (updatedGame.status === 'completed' && !endTime) {
            setEndTime(Date.now());
        }
    };

    // 添加创建游戏的处理函数
    const handleCreateGame = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            // 固定为4轮游戏，每轮20个硬币
            const gameId = await gameService.createGame(playerCount, 4, 20);
            if (gameId) {
                // 加入游戏
                const playerId = await gameService.joinGame(gameId, playerName);
                
                // 更新状态
                setGameId(gameId);
                setPlayerId(playerId);
                
                // 创建WebSocket连接
                const ws = new WebSocketService(
                    gameId,
                    playerName,
                    handleGameUpdate,
                    syncFlippedCoins
                );
                setWsService(ws);
                
                // 获取初始游戏状态
                const initialGameState = await gameService.getGameState(gameId);
                setGame(initialGameState);
                
                // 设置开始时间
                setStartTime(Date.now());
                
                console.log('Game created successfully:', { gameId, playerId });
            }
        } catch (err) {
            console.error('Error creating game:', err);
            setError(err instanceof Error ? err.message : 'Failed to create game');
        }
    };

    // 添加加入游戏的处理函数
    const handleJoinGame = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setError(null);
            if (joinGameId) {
                // 检查游戏是否存在
                const exists = await gameService.checkGameExists(joinGameId);
                if (!exists) {
                    setError('Game not found');
                    return;
                }
                
                // 加入游戏
                const playerId = await gameService.joinGame(joinGameId, playerName);
                
                // 更新状态
                setGameId(joinGameId);
                setPlayerId(playerId);
                
                // 创建WebSocket连接
                const ws = new WebSocketService(
                    joinGameId,
                    playerName,
                    handleGameUpdate,
                    syncFlippedCoins
                );
                setWsService(ws);
                
                // 获取游戏状态
                const gameState = await gameService.getGameState(joinGameId);
                setGame(gameState);
                
                // 设置开始时间
                setStartTime(Date.now());
                
                console.log('Joined game successfully:', { gameId: joinGameId, playerId });
            }
        } catch (err) {
            console.error('Error joining game:', err);
            setError(err instanceof Error ? err.message : 'Failed to join game');
        }
    };

    // 添加开始游戏的处理函数
    const handleStartGame = async () => {
        if (!gameId) return;
        
        try {
            await gameService.startGame(gameId);
            const currentTime = Date.now();
            setStartTime(currentTime);
            setBatchStartTimes(prev => ({
                ...prev,
                1: { 1: currentTime }
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start game');
        }
    };

    // 修改handleCompleteSubBatch函数，记录永久翻转状态
    const handleCompleteSubBatch = async (batchNum: number, subBatchIndex: number) => {
        if (!game || !playerId || !wsService) return;
        
        try {
            if (!canExecuteBatch(batchNum, subBatchIndex)) {
                setError('Please complete previous batches first');
                return;
            }

            const subBatchTasks = game.tasks.filter(t => 
                t.batch_number === batchNum && 
                t.sub_batch_number === subBatchIndex &&
                t.assigned_to === playerId
            );

            const buttonKey = `${playerId}-${batchNum}-${subBatchIndex}`;
            setCompletedSubBatches(prev => {
                const newSet = new Set(Array.from(prev));
                newSet.add(buttonKey);
                return newSet;
            });

            // 完成当前子批次的任务
            for (const task of subBatchTasks) {
                await wsService.completeTask(task.id);
            }

            // 检查是否完成了当前批次的所有子批次
            const allSubBatchesInCurrentBatch = game.tasks.filter(t =>
                t.batch_number === batchNum &&
                t.assigned_to === playerId
            );

            const allSubBatchesCompleted = allSubBatchesInCurrentBatch.every(t =>
                t.status === TaskStatus.COMPLETED
            );

            // 如果完成了当前批次的所有子批次，设置下一批次的开始时间
            if (allSubBatchesCompleted && batchNum < game.max_batches) {
                const nextBatchNum = batchNum + 1;
                const currentTime = Date.now();
                setBatchStartTimes(prev => ({
                    ...prev,
                    [nextBatchNum]: {
                        ...prev[nextBatchNum],
                        [nextBatchNum]: currentTime
                    }
                }));
                // 更新全局startTime
                setStartTime(currentTime);
            }

            // 更新永久翻转状态
            const permanentFlips = permanentFlippedCoins[playerId] || [];
            const currentFlips = flippedCoins[playerId] || [];
            const allFlips = Array.from(new Set([...permanentFlips, ...currentFlips]));

            setFlippedCoins(prev => ({
                ...prev,
                [playerId]: allFlips
            }));

            // 保存当前批次的累计时间
            const batchStartTime = (batchStartTimes[batchNum] || {})[batchNum];
            if (batchStartTime) {
                const previousTime = (batchElapsedTimes[batchNum] || {})[playerId] || 0;
                const elapsedTime = currentTime - batchStartTime + previousTime;
                setBatchElapsedTimes(prev => ({
                    ...prev,
                    [batchNum]: {
                        ...(prev[batchNum] || {}),
                        [playerId]: elapsedTime
                    }
                }));
            }

        } catch (error) {
            console.error('Error completing sub-batch:', error);
            setError('Failed to complete sub-batch');
        }
    };

    // 添加一个新的useEffect来处理新任务的接收
    useEffect(() => {
        if (!game || !playerId) return;

        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        const currentBatchTasks = game.tasks.filter(t => 
            t.batch_number === currentPlayer.current_batch && 
            t.assigned_to === playerId
        );

        // 当收到新的PENDING任务时，设置新的开始时间
        if (currentBatchTasks.length > 0 && 
            currentBatchTasks.every(t => t.status === TaskStatus.PENDING) &&
            currentPlayer.status === PlayerStatus.ACTIVE) {
            const currentTime = Date.now();
            const currentBatch = currentPlayer.current_batch;
            
            // 设置新批次的开始时间
            setBatchStartTimes(prev => ({
                ...prev,
                [currentBatch]: {
                    ...(prev[currentBatch] || {}),
                    [currentBatch]: currentTime
                }
            }));
        }
    }, [game?.tasks, game?.players, playerId]);

    // 添加一个新的useEffect来监听玩家状态变化
    useEffect(() => {
        if (!game || !playerId) return;

        const currentPlayer = game.players.find(p => p.id === playerId);
        if (!currentPlayer) return;

        // 当玩家状态变为ACTIVE时，立即开始计时
        if (currentPlayer.status === PlayerStatus.ACTIVE) {
            const currentTime = Date.now();
            const currentBatch = currentPlayer.current_batch;
            
            // 设置新的开始时间
            setBatchStartTimes(prev => ({
                ...prev,
                [currentBatch]: {
                    ...(prev[currentBatch] || {}),
                    [currentBatch]: currentTime
                }
            }));
        }
    }, [game?.players, playerId]);

    return (
        <Container>
            {!gameId ? (
                <>
                    {renderMainMenu()}
                    {renderHelpDialog()}
                </>
            ) : game ? (
                renderGame()
            ) : (
                <CircularProgress />
            )}
            
            {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                </Alert>
            )}
        </Container>
    );
}; 