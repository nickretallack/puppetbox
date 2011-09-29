(function() {
  var app, express, io, port, socketio;
  express = require('express');
  socketio = require('socket.io');
  port = 5000;
  app = express.createServer();
  app.use(express.static(__dirname));
  io = socketio.listen(app);
  io.set('log level', 1);
  io.sockets.on('connection', function(socket) {
    socket.on('move', function(data) {
      return socket.broadcast.emit('move', data);
    });
    return socket.on('create', function(data) {
      return socket.broadcast.emit('create', data);
    });
  });
  app.listen(port);
  console.log("Running on port " + port);
}).call(this);
