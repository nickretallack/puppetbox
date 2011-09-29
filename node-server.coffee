express = require 'express'
Faye = require 'faye'
port = 5000

app = express.createServer()
app.use express.static __dirname
app.set 'views', __dirname

faye = new Faye.NodeAdapter mount:'/socket'

faye.attach app

app.get '/room/:room', (req, res) ->
    res.render 'room.ejs', room:req.params.room, layout:false

app.listen port
console.log "Running on port #{port}"
