(function() {
  var Faye, Flow, Guid, Persistence, app, db, db_uri, express, faye, pg, pg_client, port;
  port = 5000;
  db_uri = 'tcp://localhost/puppetbox';
  express = require('express');
  Faye = require('faye');
  pg = require('pg');
  db = require('./library/standard/postgres-helper');
  Guid = require('./library/standard/guid').Guid;
  Flow = require('./library/standard/flow');
  app = express.createServer();
  app.use(express.static(__dirname));
  app.set('views', __dirname);
  faye = new Faye.NodeAdapter({
    mount: '/socket'
  });
  faye.attach(app);
  pg_client = new pg.Client(db_uri);
  pg_client.connect();
  db.set_db(pg_client);
  app.get('/room/:room', function(req, res) {
    var room_name;
    room_name = req.params.room;
    Flow().seq(function(next) {
      return db.query("select * from room where name = $1", [room_name], next);
    }).seq(function(next, result) {
      var room_id;
      if (result.rowCount === 0) {
        room_id = Guid();
        return db.query("insert into room (id, name) values ($1, $2)", [room_id, room_name], function() {
          return next(room_id);
        });
      } else {
        return next(result.rows[0].id);
      }
    }).seq(function(next, room_id) {
      return console.log(room_id);
    });
    return db.query("select item.id, item.position, image.source from item\njoin room on room.id = item.room_id and room.name = $1\njoin image on image.id = item.image_id", [room_name], function(result) {
      console.log(arguments);
      return res.render('room.ejs', {
        layout: false,
        room: room_name,
        items: JSON.stringify(result.rows)
      });
    });
  });
  Persistence = {
    incoming: function(message, callback) {
      var command, image_guid, item_guid, room_name, type, _ref;
      _ref = message.channel.split('/'), type = _ref[0], room_name = _ref[1], command = _ref[2];
      if (type === 'room') {
        if (command === 'create') {
          image_guid = Guid();
          item_guid = Guid();
          return Flow().seq(function(next) {
            return db.query("begin", next);
          }).seq(function(next) {
            return db.query("insert into image (id, source) values ($1, $2)", [image_guid, message.data.source], next);
          }).seq(function(next) {
            return callback(message);
          });
        }
      }
    }
  };
  faye.addExtension(Persistence);
  app.listen(port);
  console.log("Running on port " + port);
}).call(this);
