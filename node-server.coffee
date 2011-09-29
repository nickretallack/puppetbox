express = require 'express'
socketio = require 'socket.io'

app = express.createServer()
app.use express.static __dirname
io = socketio.listen app
io.set 'log level', 1
io.sockets.on 'connection', (socket) ->
    socket.on 'move', (data) ->
        socket.broadcast.emit 'move', data
    socket.on 'create', (data) ->
        socket.broadcast.emit 'create', data
app.listen 5000
