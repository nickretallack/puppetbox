express = require 'express'
socketio = require 'socket.io'
port = 5000

app = express.createServer()
app.use express.static __dirname
app.set 'views', __dirname
io = socketio.listen app
io.set 'log level', 1
io.sockets.on 'connection', (socket) ->
    socket.on 'move', (data) ->
        socket.broadcast.emit 'move', data
    socket.on 'create', (data) ->
        socket.broadcast.emit 'create', data

app.get '/:room', (req, res) ->
    res.render 'room.ejs', room:req.params.room, layout:false

app.listen port
console.log "Running on port #{port}"
