import express from 'express'
import expressWs from 'express-ws'
import cors from 'cors'
import { customAlphabet } from 'nanoid'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()

const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', 7)

const games = []

const wserver = expressWs(app)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务
app.use(express.static(path.join(__dirname, '../build')))

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'))
})

function broadcast(ws, msg) {
  console.log(msg)
  wserver.getWss().clients.forEach(client => {
    if (client !== ws && client.readyState === 1) {
      client.send(msg)
    }
  })
}

app.post('/create_game', (req, res) => {
  const { name, player_count } = req.body
  const gameId = nanoid()
  const playerId = nanoid()
  const game = {
    gameId: gameId,
    status: 'waiting',
    remainingTime: 120,
    config: {
      rounds: 5,
      timePerRound: 120,
      playerCount: player_count,
      blocks: 20,
      balls: ["red", "green", "blue"]
    },
    players: [
      {
        id: playerId,
        name: name,
        balls: [],
        position: 1,
        index: 1,
        isOwn: true
      }
    ],
    rounds: [
      {
        round: 1,
      }
    ],
    results: [
      { round: 1, score: 0 },
      { round: 2, score: 0 },
      { round: 3, score: 0 },
      { round: 4, score: 0 },
      { round: 5, score: 0 }
    ],
    "currentRound": 1
  }
  games.push(game)
  res.json({ game: game, playerId: playerId })
})

app.post('/join_game', (req, res) => {
  const { name, game_id } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    const playerId = nanoid()
    game.players.push({
      id: playerId,
      name: name,
      balls: [],
      position: game.players.length + 1,
      index: game.players.length + 1
    })
    broadcast(null, JSON.stringify(game))
    res.json({ game: game, playerId: playerId })
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.post('/start_game', (req, res) => {
  const { game_id, player_id, players, round_count } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.status = 'in_progress'
    game.players = players.sort((a, b) => a.position - b.position)
    game.players.forEach((player, index) => {
      player.index = index + 1
      player.balls = []
      player.process = []
    });
    game.config.roundCount = round_count
    const player = game.players.find(p => p.index === 1)
    player.balls.push({
      color: game.config.balls[Math.floor(Math.random() * game.config.balls.length)],
      position: 0,
      process: [1],
      playerId: player_id
    })
    broadcast(null, JSON.stringify(game))
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.post('/end_game', (req, res) => {
  const { game_id } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.status = 'end'
    broadcast(null, JSON.stringify(game))
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
});

app.post('/update_game', (req, res) => {
  const { game_id, players } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.players = players
    broadcast(null, JSON.stringify(game))
    res.json(game)
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.post('/update_round_time_status', (req, res) => {
  const { game_id, remainingTime, currentRound, status } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.status = status
    game.currentRound = currentRound
    game.remainingTime = remainingTime
    broadcast(null, JSON.stringify(game))
    res.json(game)
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.post('/update_results', (req, res) => {
  const { game_id, results } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.results = results
    broadcast(null, JSON.stringify(game))
    res.json(game)
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.ws('/ws', function(ws, req) {
  ws.on('message', function(msg) {
    const data = JSON.parse(msg)
    const game = games.find(g => g.gameId === data.gameId)
    if (game) {
      broadcast(ws, msg)
    }
  });
});

app.listen(5000, '0.0.0.0', () => {
    console.log('Server started on port 5000, accessible from local network');
});
