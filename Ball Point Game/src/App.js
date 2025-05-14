import React from 'react';
import {
  Alert, CircularProgress, Container, Card, Box, Typography, Tabs, Tab, TextField, Button, TableContainer,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import axios from 'axios';

const MAX_PLAYERS = 5

const SERVER_URL = '';
const WS_URL = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';

const ws = new WebSocket(WS_URL);

function App() {
  const [gameId, setGameId] = React.useState(null)
  const [game, setGame] = React.useState(null)
  const [error, setError] = React.useState(null)

  const [activeTab, setActiveTab] = React.useState(0)
  const [playerId, setPlayerId] = React.useState(null)
  const [playerName, setPlayerName] = React.useState('')
  const [playerCount, setPlayerCount] = React.useState(MAX_PLAYERS)
  const [joinGameId, setJoinGameId] = React.useState('')
  const [roundCount, setRoundCount] = React.useState(5)
  const [timeLeave, setTimeLeave] = React.useState(120)
  const [count, setCount] = React.useState(1)
  const [showHelp, setShowHelp] = React.useState(false);

  React.useEffect(() => {
    // sync with server
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.gameId === gameId) {
        setGame(data)
      }
    }
    const handleKeyDown = (e) => {
      // 添加调试信息
      console.log('Key pressed:', e.key);
      console.log('Game status:', game?.status);
      console.log('Player ID:', playerId);

      if (e.key === 'v') {
        console.log(game);
        return;
      }

      // 首先验证游戏状态
      if (!gameId || !game || game.status !== 'in_progress') {
        console.log('Game not in progress');
        return;
      }

      // 验证当前玩家
      const player = game.players.find(player => player.id === playerId);
        if (!player) {
        console.log('Player not found');
        return;
            }

      // 验证玩家是否有球
      const balls = player.balls;
      const ball = balls[balls.length - 1];
          if (!ball) {
        console.log('No ball available');
            return;
          }

      // 验证球是否属于当前玩家
      if (ball.playerId !== playerId) {
        console.log('Ball belongs to another player');
        return;
      }

      // 处理具体的按键
      switch (e.key.toLowerCase()) {
        case 'r':
          if (ball.color === 'red') {
            handleColorMatch(ball);
          }
          break;
        case 'g':
          if (ball.color === 'green') {
            handleColorMatch(ball);
          }
          break;
        case 'b':
          if (ball.color === 'blue') {
            handleColorMatch(ball);
          }
          break;
        case 'enter':
          handleEnterKey(ball);
          break;
        case 'n':
          handleNewBall();
          break;
        case 'p':
          handlePoint();
          break;
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    const timer = setInterval(() => {
      if (game && game.status === 'in_progress' && game.players.find(player => player.id === playerId).isOwn) {
        const newGame = { ...game }
        setTimeLeave(timeLeave - 1)
        if (timeLeave < 0 && newGame.currentRound < newGame.config.rounds) {
          newGame.currentRound += 1
          newGame.status = 'waiting'
          newGame.remainingTime = 120
          setTimeLeave(120)
        } else if (timeLeave < 0 && newGame.currentRound === newGame.config.rounds) {
          newGame.status = 'end'
          clearInterval(timer)
        }
        setGame(newGame)
        axios.post(`${SERVER_URL}/update_round_time_status`, {
          game_id: gameId,
          remainingTime: timeLeave,
          status: newGame.status,
          currentRound: newGame.currentRound
        })
      }
    }, 1000)
    return () => {
      clearInterval(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [game, gameId, playerId, timeLeave])

  const handleCreateGame = (e) => {
    e.preventDefault()
    axios.post(`${SERVER_URL}/create_game`, {
      name: playerName,
      player_count: playerCount,
      round_count: 5
    }).then(res => {
      setGameId(res.data.game.gameId)
      setGame(res.data.game)
      setPlayerId(res.data.playerId)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const handleJoinGame = (e) => {
    e.preventDefault()
    axios.post(`${SERVER_URL}/join_game`, {
      name: playerName,
      game_id: joinGameId
    }).then(res => {
      setGameId(res.data.game.gameId)
      setGame(res.data.game)
      setPlayerId(res.data.playerId)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const startGame = () => {
    // players should be more than 1
    if (game.players.length < game.config.playerCount) {
      setError(`Minimum ${game.config.playerCount} players required to start the game`)
      return
    }
    let flag = 0
    // players positon should be unique
    // players position should be between 1 and 20
    // players position should be at least 2 blocks apart
    game.players.forEach((player, index) => {
      if (player.position < 1 || player.position > game.config.blocks) {
        flag = 1
      }
      if (index > 0 && Math.abs(player.position - game.players[index - 1].position) < 2) {
        flag = 2
      }
    })
    if (flag === 1) {
      setError('Invalid player position')
      return
    }
    if (flag === 2) {
      setError('Players should be at least 1 blocks apart')
      return
    }
    setTimeLeave(120) // Reset time to 120 seconds when starting the game
    const newGame = { ...game };
    newGame.config.roundCount = roundCount;
    setGame(newGame);
    axios.post(`${SERVER_URL}/start_game`, {
      game_id: gameId,
      player_id: playerId,
      players: game.players,
      round_count: roundCount
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const handleColorMatch = (ball) => {
    if (count === 2) {
      ball.color = game.config.balls[Math.floor(Math.random() * 3)];
      ball.position += 1;
      if (ball.position > game.config.blocks) {
        ball.position = 1;
      }
      setCount(1);
    } else {
      setCount(2);
    }

    // 更新游戏状态并确认
    axios.post(`${SERVER_URL}/update_game`, {
      game_id: gameId,
      players: game.players
    })
    .then(res => {
      console.log('Game state updated successfully');
      setGame(res.data);
    })
    .catch(err => {
      console.error('Failed to update game state:', err);
      setError(err.message);
    });
  };

  const handleEnterKey = (ball) => {
    if (!ball) return;

    const currentPlayer = game.players.find(player => player.id === playerId);
    const nextPlayer = game.players.find(player => player.position === ball.position);
    
    if (nextPlayer && nextPlayer.index !== currentPlayer.index + 1 && nextPlayer.index !== (currentPlayer.index - 1 || 1)) {
      if (ball.process.includes(nextPlayer.index) || ball.process.filter((e) => e === 1).length < 2) {
        ball.process.push(nextPlayer.index);
        ball.position = nextPlayer.position;
        ball.playerId = nextPlayer.id;
        ball.color = game.config.balls[Math.floor(Math.random() * 3)];
        nextPlayer.balls = [ball, ...nextPlayer.balls];
      }
    }
    
    // 从当前玩家的球列表中移除球
    const currentPlayerBalls = currentPlayer.balls;
    currentPlayerBalls.splice(currentPlayerBalls.length - 1, 1);

    axios.post(`${SERVER_URL}/update_game`, {
      game_id: gameId,
      players: game.players
    }).then(res => {
      console.log('Game state updated successfully');
      setGame(res.data);
    }).catch(err => {
      console.error('Failed to update game state:', err);
      setError(err.message);
    });
  };

  const handleNewBall = () => {
    const player = game.players.find(player => player.id === playerId);
    if (player.index === 1) {
      player.balls.push({
        color: game.config.balls[Math.floor(Math.random() * 3)],
        position: player.position,
        process: [player.index],
        playerId: player.id,
        index: player.index
      });
    }

    axios.post(`${SERVER_URL}/update_game`, {
      game_id: gameId,
      players: game.players
    }).then(res => {
      console.log('Game state updated successfully');
      setGame(res.data);
    }).catch(err => {
      console.error('Failed to update game state:', err);
      setError(err.message);
    });
  };

  const handlePoint = () => {
    const currentPlayer = game.players.find(p => p.id === playerId);
    if (currentPlayer && currentPlayer.index === 1) {
      const playerWithCompleteBall = game.players.find(player => 
        player.balls.some(b => 
          b.process && 
          b.process.sort().join('') === '1' + game.players.map(p => p.index).sort().join('')
        )
      );

      if (playerWithCompleteBall) {
        const newGame = { ...game };
        newGame.results[game.currentRound - 1].score += 1;
        
        const updatedPlayer = newGame.players.find(p => p.id === playerWithCompleteBall.id);
        if (updatedPlayer) {
          updatedPlayer.balls = updatedPlayer.balls.filter(b => 
            !b.process || 
            b.process.sort().join('') !== '1' + game.players.map(p => p.index).sort().join('')
          );
        }

        setGame(newGame);

        axios.post(`${SERVER_URL}/update_game`, {
          game_id: gameId,
          players: newGame.players
        }).then(res => {
          console.log('Game state updated successfully');
          setGame(res.data);
        }).catch(err => {
          console.error('Failed to update game state:', err);
          setError(err.message);
        });

        axios.post(`${SERVER_URL}/update_results`, {
          game_id: gameId,
          results: newGame.results
        }).then(res => {
          console.log('Results updated successfully');
          setGame(res.data);
        }).catch(err => {
          console.error('Failed to update results:', err);
          setError(err.message);
        });
      }
    }
  };

  const renderCircle = React.useCallback((index) => {
    let result = [];
    for (let i = 0; i < game.players.length; i++) {
      const player = game.players[i]
      for (let j = 0; j < game.players[i].balls.length; j++) {
        if (game.players[i].balls[j].position - 1 === index) {
          result.push(
            <Box
              key={game.players[i].balls[j].position}
              sx={{
                background: "gray",
                marginTop: "10px",
                padding: 2,
                display: 'flex',
                flexDirection: "row",
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <span>{player.name}:{game.players[i].balls[j].process.sort().join('') === '1' + game.players.map(player => player.index).sort().join('') ? 'end' : ''}</span>
              <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: game.players[i].balls[j].color, ml: 1 }} >
              </Box>
            </Box>
          )
        }
      }
    }
    return result
  }, [game])
  const renderGameProgress = () => {
    const currentRoundResult = game.results[game.currentRound - 1] || { score: 0 };
    const currentPlayer = game.players.find(player => player.id === playerId);
    const currentBall = currentPlayer?.balls[currentPlayer.balls.length - 1];

    return (
      <Box sx={{ 
        p: 3, 
        backgroundColor: '#f0f8ff',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <Box>
            <Typography variant="h4" sx={{ 
              mb: 1, 
              color: '#2c3e50',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
            }}>
              Game ID: {game.gameId} &nbsp;&nbsp; 
              <Box component="span" sx={{ 
                color: game.status === 'in_progress' ? '#27ae60' : 
                       game.status === 'waiting' ? '#f39c12' : '#e74c3c',
                fontWeight: 'bold'
              }}>
                {game.status === 'waiting' ? 'Waiting' : game.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </Box>
              {game.players.some(player => player.id === playerId) && 
               game.players.find(player => player.id === playerId).isOwn && (
                <Button 
                  variant="contained" 
                  onClick={startGame} 
                  disabled={game.status !== 'waiting'}
                  sx={{
                    ml: 2,
                    background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2980b9 0%, #1f6fb7 100%)',
                      boxShadow: '0 6px 8px rgba(0,0,0,0.2)',
                    },
                    '&:disabled': {
                      background: 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)',
                      color: 'white',
                    }
                  }}
                >
                  Start Game
                </Button>
              )}
            </Typography>
            <Typography variant="h5" sx={{ 
              color: '#34495e',
              fontWeight: 'medium',
              mb: 1
            }}>
              Player: <Box component="span" sx={{ color: '#2980b9', fontWeight: 'bold' }}>{currentPlayer?.name}</Box>
            </Typography>
            <Typography variant="h5" sx={{ 
              color: '#34495e',
              fontWeight: 'medium',
              mb: 1
            }}>
              Round: <Box component="span" sx={{ color: '#e67e22', fontWeight: 'bold' }}>
                {game.currentRound} / {game.config.rounds}
              </Box> 
              Score: <Box component="span" sx={{ color: '#27ae60', fontWeight: 'bold' }}>
                {currentRoundResult.score}
              </Box>
            </Typography>
            <Typography variant="h5" sx={{ 
              color: '#34495e',
              fontWeight: 'medium'
            }}>
              Time: <Box component="span" sx={{ 
                color: timeLeave < 30 ? '#e74c3c' : '#2c3e50',
                fontWeight: 'bold'
              }}>
                {currentPlayer?.isOwn ? timeLeave : game.remainingTime - 1} seconds
              </Box>
            </Typography>
            {currentBall && (
              <Box sx={{ 
                mt: 2, 
                p: 2, 
                border: '2px solid #3498db',
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.8)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                <Typography variant="h6" sx={{ 
                  color: '#2c3e50',
                  fontWeight: 'bold',
                  mb: 1
                }}>
                  Current Ball Status:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body1" sx={{ 
                    color: '#34495e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    Color: <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      background: currentBall.color,
                      border: '1px solid #2c3e50'
                    }} />
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#34495e' }}>
                    Position: {currentBall.position}
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#34495e' }}>
                    Process: {currentBall.process.join(' → ')}
                  </Typography>
                  <Typography variant="body1" sx={{ 
                    color: currentBall.playerId === playerId ? '#27ae60' : '#e74c3c',
                    fontWeight: 'bold'
                  }}>
                    Owner: {currentBall.playerId === playerId ? 'You' : 'Other Player'}
            </Typography>
          </Box>
        </Box>
            )}
          </Box>
        </Box>

        <Box className="flex justify-center items-center" sx={{ 
          border: '2px solid #3498db',
          borderRadius: 2,
          p: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <Box className="flex justify-start flex-wrap" sx={{ 
            width: 1000, 
            height: 1000, 
            position: 'relative',
            background: 'radial-gradient(circle, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: 2
          }}>
            {Array(game.config.blocks).fill(0).map((_, index) => {
                const totalBlocks = game.config.blocks;
              const radius = 500;
              const angle = (index / totalBlocks) * 2 * Math.PI;
              const centerX = 540;
              const centerY = 540;
              const x = centerX + radius * Math.cos(angle) - 50;
              const y = centerY + radius * Math.sin(angle) - 50;

                return (
                  <Box key={index} className="flex flex-col justify-center items-center" sx={{
                    width: 100,
                    minHeight: 100,
                  border: '2px solid #3498db',
                    mr: 1,
                    mt: 1,
                  background: game.players.some(player => player.position - 1 === index) ? 
                    'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'white',
                    position: 'absolute',
                    left: x,
                    top: y,
                  borderRadius: 2,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  }
                  }}>
                  <Typography sx={{ 
                    color: game.players.some(player => player.position - 1 === index) ? 'white' : '#2c3e50',
                    fontWeight: 'bold',
                    display: game.players.some(player => player.position - 1 === index) ? 'block' : 'none'
                  }}>
                    Index: {game.players.some(player => player.position - 1 === index) ? 
                      game.players.find(player => player.position - 1 === index).index : ''}
                    </Typography>
                  <Typography sx={{ 
                    color: game.players.some(player => player.position - 1 === index) ? 'white' : '#2c3e50',
                    fontWeight: 'medium'
                  }}>
                    {game.players.some(player => player.position - 1 === index) ? 
                      game.players.find(player => player.position - 1 === index).name : ''}
                    </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: "column", 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    width: "100%",
                    gap: 1
                  }}>
                      {renderCircle(index).map((item) => item)}
                    </Box>
                  </Box>
                )
            })}
          </Box>
        </Box>
      </Box>
    )
  }

  const renderStatices = () => {
    return (
      <Box sx={{ p: 3, backgroundColor: 'background.default', minHeight: '100vh', display: "flex", flexDirection: "column" }}>
        <Typography variant="h4" sx={{ mb: 3, textAlign: 'center', color: 'primary.main' }}>
          Game Summary
        </Typography>
        <Button
          fullWidth
          variant="contained"
          type="submit"
          onClick={() => {
            setGameId(null)
            setGame(null)
            setPlayerId(null)
            setError(null)

            setActiveTab(0)
            setPlayerCount(MAX_PLAYERS)
            setPlayerName('')
            setRoundCount(5)
            setTimeLeave(120)
            setCount(1)
          }}
          sx={{ mb: 3 }}
        >
          Restart Game
        </Button>
        <TableContainer sx={{ mb: 2 }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Round</TableCell>
                <TableCell align="right">Current Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {
                game.results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell component="th" scope="row">
                      Round {result.round}
                    </TableCell>
                    <TableCell align="right">{result.score}</TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    )
  }

  const renderGame = () => {
    return (
      <Box sx={{ 
        p: 3, 
        backgroundColor: '#f0f8ff',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
          p: 3,
          borderRadius: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <Box>
            <Typography variant="h4" sx={{ 
              mb: 1, 
              color: '#2c3e50',
              fontWeight: 'bold',
              textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
            }}>
              Game ID: {game.gameId} &nbsp;&nbsp;
              <Box component="span" sx={{ 
                color: game.status === 'in_progress' ? '#27ae60' : 
                       game.status === 'waiting' ? '#f39c12' : '#e74c3c',
                fontWeight: 'bold'
              }}>
                {game.status === 'waiting' ? 'Waiting' : game.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </Box>
              {game.players.some(player => player.id === playerId) && 
               game.players.find(player => player.id === playerId).isOwn && (
                <Button 
                  variant="contained" 
                  onClick={startGame} 
                  disabled={game.status !== 'waiting'}
                  sx={{
                    ml: 2,
                    background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #2980b9 0%, #1f6fb7 100%)',
                      boxShadow: '0 6px 8px rgba(0,0,0,0.2)',
                    },
                    '&:disabled': {
                      background: 'linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%)',
                      color: 'white',
                    }
                  }}
                >
                    Start Game
                  </Button>
              )}
            </Typography>
            <Typography variant="h5" sx={{ 
              color: '#34495e',
              fontWeight: 'medium',
              mb: 1
            }}>
              Current Round: {game.currentRound}
            </Typography>
            <Typography variant="h5" sx={{ 
              color: '#34495e',
              fontWeight: 'medium'
            }}>
              Status: <Box component="span" sx={{ 
                color: game.status === 'waiting' ? '#f39c12' : 
                       game.status === 'in_progress' ? '#27ae60' : '#e74c3c',
                fontWeight: 'bold'
              }}>
                {game.status === 'waiting' ? 'Waiting' : game.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </Box>
            </Typography>
            {game.players.find(player => player.id === playerId)?.isOwn && (
            <TextField
              fullWidth
              label="Round Score target"
              type="number"
              required
              value={roundCount}
              onChange={(e) => setRoundCount(Number(e.target.value))}
              helperText="Round Score target"
                sx={{ 
                  mb: 3, 
                  mt: 2,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#3498db',
                    },
                    '&:hover fieldset': {
                      borderColor: '#2980b9',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#3498db',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#2c3e50',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#3498db',
                  }
                }}
              autoComplete="off"
            />
            )}
          </Box>
        </Box>

        {/* 添加分数表格 */}
        <TableContainer sx={{ 
          mb: 3, 
          maxWidth: 400,
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: 2,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <Table size="medium">
            <TableHead>
              <TableRow sx={{ background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Round</TableCell>
                <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {game.results.map((result, index) => (
                <TableRow key={index} sx={{ 
                  '&:nth-of-type(odd)': { backgroundColor: 'rgba(52, 152, 219, 0.1)' },
                  '&:hover': { backgroundColor: 'rgba(52, 152, 219, 0.2)' }
                }}>
                  <TableCell component="th" scope="row" sx={{ color: '#2c3e50' }}>
                      Round {result.round}
                    </TableCell>
                  <TableCell align="right" sx={{ color: '#27ae60', fontWeight: 'bold' }}>
                    {result.score}
                  </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ 
          border: '2px solid #3498db',
          borderRadius: 2,
          p: 3,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          mb: 3
        }}>
          {game.players.map((player, index) => (
            <Box key={index} sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              mt: 1,
              p: 2,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #e8f3ff 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #e8f3ff 0%, #d6e6ff 100%)',
              }
            }}>
              <Typography variant="h6" sx={{ 
                color: '#2c3e50',
                fontWeight: 'medium'
              }}>
                Player {player.index}: {player.name}
                </Typography>
                <TextField
                  label="Position"
                type="number"
                  value={player.position}
                  onChange={(e) => {
                    if (e.target.value < 1 || e.target.value > game.config.blocks) {
                      setError('Position must be between 1 and 20')
                      return
                    }
                    setError(null)
                    const newGame = { ...game }
                    newGame.players[index].position = Number(e.target.value)
                    const players = JSON.parse(JSON.stringify(newGame.players)).sort((a, b) => a.position - b.position)
                    newGame.players.forEach((player, index) => {
                      players.forEach((p, i) => {
                        if (player.id === p.id) {
                          player.index = i + 1
                        }
                      })
                    })
                    setGame(newGame)
                    axios.post(`${SERVER_URL}/update_game`, {
                      game_id: gameId,
                      players: newGame.players
                    }).then(res => {
                      setGame(res.data)
                    }).catch(err => {
                      setError(err.message)
                    })
                  }}
                sx={{
                  width: 120,
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': {
                      borderColor: '#3498db',
                    },
                    '&:hover fieldset': {
                      borderColor: '#2980b9',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#3498db',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#2c3e50',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#3498db',
                  }
                }}
                />
              </Box>
          ))}
        </Box>

        <Box className="flex justify-center items-center" sx={{ 
          border: '2px solid #3498db',
          borderRadius: 2,
          p: 2,
          background: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <Box className="flex justify-start flex-wrap relative" sx={{ 
            width: 1000, 
            height: 1000, 
            position: 'relative',
            background: 'radial-gradient(circle, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: 2
          }}>
            {Array(game.config.blocks).fill(0).map((_, index) => {
                const totalBlocks = game.config.blocks;
              const radius = 500;
              const angle = (index / totalBlocks) * 2 * Math.PI;
              const centerX = 540;
              const centerY = 540;
              const x = centerX + radius * Math.cos(angle) - 50;
              const y = centerY + radius * Math.sin(angle) - 50;

                return (
                  <Box key={index} className="flex flex-col justify-center items-center" sx={{
                    width: 100,
                    height: 100,
                  border: '2px solid #3498db',
                    mr: 1,
                    mt: 1,
                  background: game.players.some(player => player.position - 1 === index) ? 
                    'linear-gradient(135deg, #3498db 0%, #2980b9 100%)' : 'white',
                    position: 'absolute',
                    left: x,
                    top: y,
                  borderRadius: 2,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.05)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                  }
                  }}>
                  <Typography sx={{ 
                    color: game.players.some(player => player.position - 1 === index) ? 'white' : '#2c3e50',
                    fontWeight: 'bold',
                    whiteSpace: 'wrap'
                  }}>
                    Index: {game.players.some(player => player.position - 1 === index) ? 
                      game.players.find(player => player.position - 1 === index).index : ''}
                    </Typography>
                  <Typography sx={{ 
                    color: game.players.some(player => player.position - 1 === index) ? 'white' : '#2c3e50',
                    whiteSpace: 'wrap'
                  }}>
                      Pos: {index + 1}
                    </Typography>
                  <Typography sx={{ 
                    color: game.players.some(player => player.position - 1 === index) ? 'white' : '#2c3e50',
                    whiteSpace: 'wrap'
                  }}>
                    {game.players.some(player => player.position - 1 === index) ? 
                      game.players.find(player => player.position - 1 === index).name : ''}
                    </Typography>
                  </Box>
                )
            })}
          </Box>
        </Box>
      </Box>
    )
  }

  const renderMainMenu = () => {
    return (
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
          borderTopRightRadius: 8
        }}>
          <Typography variant="h3" sx={{
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
            textAlign: 'center',
            mb: 1
          }}>
            Online Multiplayer Ball Point Game
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setShowHelp(!showHelp)}
            sx={{ mt: 2 }}
          >
            {showHelp ? 'Hide Instructions' : 'Show Instructions'}
          </Button>
        </Box>

        {/* Help Dialog */}
        {showHelp && (
          <Box sx={{
            p: 3,
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #dee2e6'
          }}>
            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
              Game Instructions
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Game Overview:
              </Typography>
              <Typography variant="body1">
                - This is a multiplayer game where players pass balls to each other
                - players cannot pass the ball to the neighbor player
                - The goal is to complete ball passing sequences to earn points
                - Each round has a time limit
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Controls:
              </Typography>
              <Typography variant="body1">
                - Press 'R', 'G', 'B' to match ball colors (red, green, blue)
                - Press 'Enter' to pass the ball to the next player
                - Press 'N' to create a new ball (only for player 1)
                - Press 'P' to score points (only for player 1)
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Rules:
              </Typography>
              <Typography variant="body1">
                - Players must be at least 1 blocks apart
                - Balls must be passed in sequence
                - Only player 1 can create new balls and score points
                - Complete a full sequence to earn points
              </Typography>
            </Box>
          </Box>
        )}

        {/* Bottom section with form */}
        <Box sx={{
          background: '#ffffff',
          p: 4,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8
        }}>
          <Tabs value={activeTab} onChange={(e, newValue) => {
            setActiveTab(newValue);
            setPlayerName('');
            setPlayerCount(MAX_PLAYERS);
            setJoinGameId('');
            setGame({});
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
                onChange={(e) => {
                  if (e.target.value.length > 8) {
                    setError('Name cannot be more than 8 characters');
                  } else {
                    setError('');
                  }
                  setPlayerName(e.target.value)
                }}
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
                helperText="Requiring 5 players"
                sx={{ mb: 3 }}
                autoComplete="off"
              />
              <Button
                fullWidth
                variant="contained"
                type="submit"
                disabled={!playerName || playerCount < MAX_PLAYERS || playerCount > 10}
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
    )
  }

  return (
    <Container>
      {
        error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )
      }
      {
        !gameId ?
          renderMainMenu() :
          game.status === 'waiting' ?
            renderGame() :
            game.status === 'in_progress' ?
              renderGameProgress() :
              game.status === 'end' ? renderStatices() : <CircularProgress />
      }
    </Container>
  );
}

export default App;
