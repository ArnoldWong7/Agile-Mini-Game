import React from 'react';
import {
  Alert, CircularProgress, Container, Card, Box, Typography, Tabs, Tab, TextField, Button, TableContainer,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
import ReactCanvasPaint from './ReactCanvasPaint.js'
import axios from 'axios';

const MAX_PLAYERS = 2

const ws = new WebSocket(
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
  window.location.host +
  '/ws'
)

const API_BASE_URL = '/api'

function App() {
  const [gameId, setGameId] = React.useState(null)
  const [game, setGame] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [showHelp, setShowHelp] = React.useState(false)

  const [activeTab, setActiveTab] = React.useState(0)
  const [playerId, setPlayerId] = React.useState(null)
  const [playerName, setPlayerName] = React.useState('')
  const [playerCount, setPlayerCount] = React.useState(MAX_PLAYERS)
  const [joinGameId, setJoinGameId] = React.useState('')
  const [timeLeave, setTimeLeave] = React.useState(5)
  const [timeLeave1, setTimeLeave1] = React.useState(2 * 60)
  const [timeLeave2, setTimeLeave2] = React.useState(3 * 60)
  const [timeLeave3, setTimeLeave3] = React.useState(2 * 60)
  const [timeLeave4, setTimeLeave4] = React.useState(3 * 60)
  const [draw, setDraw] = React.useState(undefined)
  const [draw1, setDraw1] = React.useState(undefined)
  const [times, setTimes] = React.useState(3)
  const [times1, setTimes1] = React.useState(1)
  const [times2, setTimes2] = React.useState(1)

  React.useEffect(() => {
    // sync with server
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.gameId === gameId) {
        data.players[0].messages = (data.players[0].messages || []).map((m) => {
          return m
        })
        setGame(data)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'v') {
        console.log(game);
        return;
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    const timer = setInterval(() => {
      if (game && game.status === 'in_progress') {
        setTimeLeave(timeLeave - 1)
        if (timeLeave <= 0) {
          setTimeLeave(0)
        }
      }
    }, 1000)

    return () => {
      clearInterval(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [game, gameId, playerId, timeLeave])

  React.useEffect(() => {
    let timer = null
    let timer1 = null
    if (game && game.status === 'in_progress' && game.currentRound === 1) {
      timer = setInterval(() => {
        setTimeLeave1(prev => {
          if (prev <= 0) {
            return 0;
          }
          if ((game.players.length > 0 && game.players[0].messages.length >= 2)) {
            return 0;
          }
          return prev - 1;
        })
      }, 1000)

      timer1 = setInterval(() => {
        setTimeLeave2(prev => {
          if (prev <= 0) {
            return 0;
          }
          if ((game.players.length > 0 && game.players[0].messages.length >= 2)) {
            return 0;
          }
          if (timeLeave1 <= 0 || (game.players.length > 0 && game.players[0].messages.length > 0)) {
            return prev - 1;
          } else {
            return prev;
          }
        })
      }, 1000)
    }
    return () => {
      clearInterval(timer)
      clearInterval(timer1)
    }
  }, [game?.status, game?.players])

  React.useEffect(() => {
    let timer = null
    let timer1 = null
    if (game && game.status === 'in_progress' && game.currentRound === 2) {
      timer = setInterval(() => {
        setTimeLeave3(prev => {
          if (prev <= 0) {
            return 0;
          }
          return prev - 1;
        })
      }, 1000)

      timer1 = setInterval(() => {
        setTimeLeave4(prev => {
          if (prev <= 0) {
            return 0;
          }
          if (game.players.length > 0 && game.players[0].messages.filter(el => el.round === 2).length > 0) {
            return prev - 1;
          } else {
            return prev;
          }
        })
      }, 1000)
    }
    return () => {
      clearInterval(timer)
      clearInterval(timer1)
    }
  }, [game?.status, game?.players])

  React.useEffect(() => {
    if (game && game.currentRound === 2 && draw1 === undefined) {
      setDraw1(null)
    }
  }, [game])
  const handleCreateGame = (e) => {
    e.preventDefault()
    axios.post(`${API_BASE_URL}/create_game`, {
      name: playerName,
      player_count: playerCount
    }).then(res => {
      setGameId(res.data.game.gameId)
      setGame(res.data.game)
      setPlayerId(res.data.playerId)
      setTimeLeave(5)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const toggleRoles = () => {
    game.players = game.players.reverse()
    setGame({ ...game })
    axios.post(`${API_BASE_URL}/update_game`, {
      game_id: gameId,
      game: game
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const handleJoinGame = (e) => {
    e.preventDefault()
    axios.post(`${API_BASE_URL}/join_game`, {
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
    if (game.players.length < game.config.playerCount) {
      setError(`Minimum ${game.config.playerCount} players required to start the game`)
      return
    }
    axios.post(`${API_BASE_URL}/start_game`, {
      game_id: gameId
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const nextRound = () => {
    setDraw(undefined)
    game.currentRound += 1
    if (game.currentRound > 2) {
      return;
    }
    axios.post(`${API_BASE_URL}/update_game`, {
      game_id: gameId,
      game: game
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const endGame = () => {
    game.status = 'end'
    axios.post(`${API_BASE_URL}/update_game`, {
      game_id: gameId,
      game: game
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }

  const handleChange = (e) => {
    const value = e.target.value
    const player = game.players.find(p => p.id === playerId)
    if (player) {
      player.description = value
    }
    setGame({ ...game })
  }

  const sendMessage = () => {
    if (game.currentRound === 1) {
      setTimes2(times2 - 1);
      if (times2 <= 0) {
        return;
      }
    }
    const player = game.players.find(p => p.id === playerId)
    player.messages = player.messages || []
    player.messages.push({ description: player.description, round: game.currentRound })
    player.description = ''
    axios.post(`${API_BASE_URL}/update_game`, {
      game_id: gameId,
      game: game
    }).then(res => {
      setGame(res.data)
      setError(null)
    }).catch(err => {
      setError(err.message)
    })
  }
  const renderPlayerOne = () => {
    if (game.status === 'in_progress' && timeLeave > 0 && playerName === game.players[0].name) {
      return <img src={game.config.image} />
    }
    if (game.status === 'in_progress' && timeLeave === 0 && game.currentRound === 1) {
      return <div style={{ width: '100%' }}>
        <ul>
          {
            (game.players[0].messages || []).filter((m) => m.round === 1).map((m, i) => {
              if (m.pic) {
                return ""
              }
              return <li key={i}>{m.description}</li>
            })
          }
        </ul>
        {
          playerName === game.players[0].name && times2 > 0 && timeLeave1 > 0 && <div>
            <textarea value={game.players[0].description} cols={50} rows={10} onChange={handleChange} disabled={playerName === game.players[1].name}></textarea><br/>
            <button onClick={sendMessage}>Send Message</button>
          </div>
        }
      </div>
    }
    if (game.status === 'in_progress' && game.currentRound === 2) {
      return <div style={{ width: '100%' }}>
        {
          playerName === game.players[0].name && <img src={game.config.image} />
        }
        <ul>
          {
            (game.players[0].messages || []).filter((m) => m.round === 2).map((m, i) => {
              if (m.pic) {
                return <li key={i}><img src={m.pic} /></li>
              }
              return <li key={i}>{m.description}</li>
            })
          }
        </ul>
        {
          playerName === game.players[0].name && <div>
            <textarea value={game.players[0].description} cols={50} rows={10} onChange={handleChange} disabled={playerName === game.players[1].name}></textarea><br/>
            <button onClick={sendMessage}>Send Message</button>
          </div>
        }
      </div>
    }
    if (game.status === 'end') {
      return <img src={game.config.image} />
    }
  }

  const sendPicMessage = () => {
    if (game.currentRound === 1) {
      setTimes1(times1 - 1);
      if (times1 <= 0) {
        return;
      }
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = draw.width;
      canvas.height = draw.height;
      ctx.putImageData(draw, 0, 0);
      game.players[0].messages.push({ pic: canvas.toDataURL(), round: 1});
      axios.post(`${API_BASE_URL}/update_game`, {
        game_id: gameId,
        game: game
      }).then(res => {
        setGame(res.data)
        setError(null)
      }).catch(err => {
        setError(err.message)
      })
    }
    if (game.currentRound === 2) {
      setTimes(times - 1)
      if (times <= 0) {
        return;
      }
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      canvas.width = draw1.width;
      canvas.height = draw1.height;
      ctx.putImageData(draw1, 0, 0);
      game.players[0].messages.push({ pic: canvas.toDataURL(), round: 2});
      axios.post(`${API_BASE_URL}/update_game`, {
        game_id: gameId,
        game: game
      }).then(res => {
        setGame(res.data)
        setError(null)
      }).catch(err => {
        setError(err.message)
      })
    }
    
  }
  const renderPlayerTwo = () => {
    if (game.status === 'in_progress' && playerName === game.players[1].name) {
      if (game.currentRound === 1) {
        return <div>
          <ReactCanvasPaint data={draw} onDraw={(data) => {
            setDraw(data)
          }} width={450} height={300} strokeWidth={10} colors={['#f5f7fa', '#000000', '#0170C1', '#FE0002', '#FFFF01', '#00AF52']} />
          {
            times1 > 0 && timeLeave1 > 0 && <button onClick={sendPicMessage}>Complete Painting</button>
          }
        </div>
      }
      if (game.currentRound === 2) {
        return <div>
          <ReactCanvasPaint data={draw1} onDraw={(data) => {
            setDraw1(data)
          }} width={450} height={300} strokeWidth={10} colors={['#f5f7fa', '#000000', '#0170C1', '#FE0002', '#FFFF01', '#00AF52']} />
          {
            times > 0 && <button onClick={sendPicMessage}>{ times > 1 ? "Send Message" : "Complete Painting"}</button>
          }
        </div>
      }
    }
    if (game.status === 'in_progress' && playerName === game.players[0].name) {
      return <ReactCanvasPaint width={450} height={300} strokeWidth={10} viewOnly data={game.currentRound === 1 ? draw : draw1} colors={['#f5f7fa', '#000000', '#0170C1', '#FE0002', '#FFFF01', '#00AF52']} />
    }
    if (game.status === 'end') {
      return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ul>
          {
            (game.players[0].messages || []).filter((el) => el.pic).map((m, i) => {
              if (i === 0 || i === 3) {
                return <li key={i}><img src={m.pic} /></li>
              }
            })
          }
        </ul>
      </div>
    }
  }
  const renderGame = () => {
    return (
      <Box sx={{ 
        p: 3, 
        backgroundColor: '#f5f7fa',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
      }}>
        <Box sx={{ 
          maxWidth: 1200, 
          mx: 'auto',
          p: 3,
          backgroundColor: 'white',
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            p: 2,
            backgroundColor: '#f8f9fa',
            borderRadius: 2
          }}>
            <Typography variant="h5" sx={{ color: '#2c3e50', fontWeight: 600 }}>
              Game ID: {game.gameId}
            </Typography>
            <Typography variant="h5" sx={{ color: '#2c3e50', fontWeight: 600 }}>
              Round: {game.currentRound}/2
            </Typography>
            <Typography variant="h5" sx={{ color: '#2c3e50', fontWeight: 600 }}>
              Status: {game.status}
            </Typography>
          </Box>

          <Box sx={{ 
            display: 'flex', 
            gap: 2,
            mb: 3
          }}>
            {game.status === 'in_progress' && game.players[0].name === playerName && game.currentRound === 1 && game.players[0].messages.filter((el) => el.pic).length > 0 && (
              <Button 
                variant="contained" 
                onClick={nextRound}
                sx={{
                  background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                  }
                }}
              >
                Next Round
              </Button>
            )}
            {game.status === 'in_progress' && game.players[0].name === playerName && game.currentRound === 2 && (
              <Button 
                variant="contained" 
                onClick={endGame}
                sx={{
                  background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                  }
                }}
              >
                End Game
              </Button>
            )}
            {game.status === 'end' && (
              <Button 
                variant="contained" 
                onClick={() => window.location.reload()}
                sx={{
                  background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                  }
                }}
              >
                Restart
              </Button>
            )}
            {game.status === 'waiting' && game.players.find((el) => el.name === playerName).isOwn && (
              <Button 
                variant="contained" 
                onClick={toggleRoles}
                sx={{
                  background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                  }
                }}
              >
                Toggle Roles
              </Button>
            )}
            {game.status === 'waiting' && game.players.find((el) => el.name === playerName).isOwn && (
              <Button 
                variant="contained" 
                onClick={startGame}
                sx={{
                  background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                  }
                }}
              >
                Start Game
              </Button>
            )}
          </Box>

          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'row', 
            gap: 3,
            p: 3,
            backgroundColor: '#f8f9fa',
            borderRadius: 4
          }}>
            <Box sx={{ 
              flex: 1,
              p: 3,
              backgroundColor: 'white',
              borderRadius: 3,
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="h5" sx={{ 
                mb: 2,
                color: '#2c3e50',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                Describer: {game.players[0].name}
                {(timeLeave1 > 0 && game.currentRound === 1) || (timeLeave3 > 0 && game.currentRound === 2) ? (
                  <Box sx={{ 
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.9rem'
                  }}>
                    {game.currentRound === 1 ? timeLeave1 : timeLeave3}s
                  </Box>
                ) : null}
              </Typography>
              <Box sx={{ 
                width: '100%', 
                minHeight: 400,
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2
              }}>
                {renderPlayerOne()}
              </Box>
            </Box>

            <Box sx={{ 
              flex: 1,
              p: 3,
              backgroundColor: 'white',
              borderRadius: 3,
              boxShadow: '0 4px 16px rgba(0,0,0,0.05)'
            }}>
              <Typography variant="h5" sx={{ 
                mb: 2,
                color: '#2c3e50',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                Painter: {game.players[1] ? game.players[1].name : 'Waiting for player 2...'}
                {(timeLeave2 > 0 && game.currentRound === 1) || (timeLeave4 > 0 && game.currentRound === 2) ? (
                  <Box sx={{ 
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.9rem'
                  }}>
                    {game.currentRound === 1 ? timeLeave2 : timeLeave4}s
                  </Box>
                ) : null}
              </Typography>
              <Box sx={{ 
                width: '100%', 
                minHeight: 400,
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2
              }}>
                {renderPlayerTwo()}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  const renderMainMenu = () => {
    return (
      <Box sx={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        p: 2
      }}>
        <Card sx={{
          maxWidth: 600,
          width: '100%',
          borderRadius: 4,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
            p: 4,
            textAlign: 'center'
          }}>
            <Typography variant="h3" sx={{
              fontWeight: 'bold',
              color: 'white',
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              mb: 2
            }}>
              Drawing Together
            </Typography>
            <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              A collaborative drawing game
            </Typography>
          </Box>

          <Box sx={{ p: 4 }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => {
                setActiveTab(newValue);
                setPlayerName('');
                setPlayerCount(MAX_PLAYERS);
                setJoinGameId('');
                setGame({});
              }} 
              sx={{ 
                mb: 4,
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px'
                }
              }}
            >
              <Tab 
                label="Create Game" 
                sx={{ 
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  fontWeight: 600
                }} 
              />
              <Tab 
                label="Join Game" 
                sx={{ 
                  textTransform: 'none',
                  fontSize: '1.1rem',
                  fontWeight: 600
                }} 
              />
            </Tabs>

            {activeTab === 0 ? (
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
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  autoComplete="off"
                />
                <TextField
                  fullWidth
                  label="Number of Players"
                  type="number"
                  disabled
                  required
                  value={playerCount}
                  onChange={(e) => setPlayerCount(Number(e.target.value))}
                  helperText="2 Players game"
                  sx={{ 
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  autoComplete="off"
                />
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={!playerName || playerCount < MAX_PLAYERS || playerCount > 10}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                    }
                  }}
                >
                  Create Game
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleJoinGame}>
                <TextField
                  fullWidth
                  label="Your Name"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  sx={{ 
                    mb: 3,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  autoComplete="off"
                />
                <TextField
                  fullWidth
                  label="Game Code"
                  required
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  sx={{ 
                    mb: 4,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2
                    }
                  }}
                  autoComplete="off"
                />
                <Button
                  fullWidth
                  variant="contained"
                  type="submit"
                  disabled={!playerName || !joinGameId}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    background: 'linear-gradient(135deg, #6B73FF 0%, #000DFF 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5B63FF 0%, #0000FF 100%)'
                    }
                  }}
                >
                  Join Game
                </Button>
              </Box>
            )}
            {showHelp && (
              <Box sx={{ 
                mt: 4, 
                p: 3, 
                backgroundColor: '#f8f9fa',
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#2c3e50', fontWeight: 600 }}>Game Instructions:</Typography>
                <Box component="ul" sx={{ pl: 2, '& li': { mb: 1.5, color: '#34495e' } }}>
                  <li>Create a game or join an existing one</li>
                  <li>Wait for other players to join</li>
                  <li>Game has two roles: Speaker and Painter</li>
                  <li>Speaker describes an image, Painter draws it</li>
                  <li>Two rounds: first round speaker can only send one message for Painter and Painter cannot send drawing message to Speaker, second round speaker can keep communicate with Painter and Painter can send drawing message two times to Speaker</li>
                  <li>Each player has limited time for their turn</li>
                  <li>Have fun and be creative!</li>
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      </Box>
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
          renderMainMenu() : renderGame()
      }
    </Container>
  );
}

export default App;
