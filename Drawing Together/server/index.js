import express from 'express'
import expressWs from 'express-ws'
import cors from 'cors'
import { customAlphabet } from 'nanoid'

const app = express()
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', 7)

const games = []

const wserver = expressWs(app)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 用 express.Router() 统一加前缀
const router = express.Router();

function broadcast(ws, msg) {
  wserver.getWss().clients.forEach(client => {
    if (client !== ws && client.readyState === 1) {
      client.send(msg)
    }
  })
}

router.post('/create_game', (req, res) => {
  const { name } = req.body
  const gameId = nanoid()
  const playerId = nanoid()
  const game = {
    gameId: gameId,
    status: 'waiting',
    config: {
      rounds: 4,
      image: '/assets/dog.jpg',
      time: 5 * 1000,
    },
    players: [
      {
        id: playerId,
        name: name,
        isOwn: true,
        description: ''
      }
    ],
    currentRound: 1
  }
  games.push(game)
  res.json({ game: game, playerId: playerId })
})

router.post('/join_game', (req, res) => {
  const { name, game_id } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    const playerId = nanoid()
    game.players.push({
      id: playerId,
      name: name,
      image: ''
    })
    broadcast(null, JSON.stringify(game))
    res.json({ game: game, playerId: playerId })
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

router.post('/start_game', (req, res) => {
  const { game_id } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.status = 'in_progress'
    broadcast(null, JSON.stringify(game))
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

router.post('/end_game', (req, res) => {
  const { game_id } = req.body
  const game = games.find(g => g.gameId === game_id)
  if (game) {
    game.status = 'end'
    broadcast(null, JSON.stringify(game))
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
});

router.post('/update_game', (req, res) => {
  const { game_id, game } = req.body
  const game1 = games.find(g => g.gameId === game_id)
  if (game1) {
    game1.status = game.status
    game1.config = game.config
    game1.currentRound = game.currentRound
    game1.players = game.players
    broadcast(null, JSON.stringify(game1))
    res.json(game1)
  } else {
    res.status(404).json({ error: 'Game not found' })
  }
})

app.use('/api', router);

app.ws('/ws', function(ws, req) {
  ws.on('message', function(msg) {
    const data = JSON.parse(msg)
    const game = games.find(g => g.gameId === data.gameId)
    if (game) {
      broadcast(ws, msg)
    }
  });
});

app.listen(8080, () => {
  console.log('Server started on port 8080')
})
