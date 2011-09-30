(function() {
  var Faye, Flow, Guid, Persistence, app, create_item, db, db_uri, express, faye, move_item, pg, pg_client, port, postgres_point;
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
    var room_id, room_name;
    room_name = req.params.room;
    room_id = null;
    return Flow().seq(function(next) {
      return db.query("select * from room where name = $1", [room_name], next);
    }).seq(function(next, result) {
      if (result.rowCount === 0) {
        room_id = Guid();
        return db.query("insert into room (id, name) values ($1, $2)", [room_id, room_name], next);
      } else {
        room_id = result.rows[0].id;
        return next();
      }
    }).seq(function(next) {
      return db.query("select item.id, item.position, image.source from item\njoin image on item.room_id = $1 and image.id = item.image_id", [room_id], next);
    }).seq(function(next, result) {
      return res.render('room.ejs', {
        layout: false,
        room: room_id,
        items: JSON.stringify(result.rows)
      });
    });
  });
  create_item = function(_arg) {
    var image_id, item_id, position, room_id, source;
    room_id = _arg.room_id, source = _arg.source, position = _arg.position;
    image_id = Guid();
    item_id = Guid();
    console.log("ITEMS! " + image_id + ", " + item_id + ", " + position);
    return Flow().seq(function(next) {
      return db.query("begin", next);
    }).seq(function(next) {
      return db.query("insert into image (id, source) values ($1, $2)", [image_id, source], next);
    }).seq(function(next) {
      return db.query("insert into item (id, room_id, image_id, position) \nvalues ($1, $2, $3, $4)", [item_id, room_id, image_id, postgres_point(position)], next);
    }).seq(function(next) {
      return db.query("end", function() {});
    });
  };
  move_item = function(_arg) {
    var item_id, position, room_id;
    room_id = _arg.room_id, item_id = _arg.item_id, position = _arg.position;
    return db.query("update item set position = $3\nwhere item.id = $2 and item.room_id = $1", [room_id, item_id, postgres_point(position)], function() {});
  };
  postgres_point = function(_arg) {
    var left, top;
    left = _arg.left, top = _arg.top;
    return "" + left + "," + top;
  };
  Persistence = {
    incoming: function(message, the_callback) {
      var callback, command, room_id, x, _ref;
      callback = function() {
        return the_callback(message);
      };
      _ref = message.channel.split('/'), x = _ref[0], room_id = _ref[1], command = _ref[2];
      if (room_id !== 'meta') {
        if (command === 'create') {
          create_item({
            room_id: room_id,
            source: message.data.source,
            position: message.data.position
          });
        }
        if (command === 'move') {
          move_item({
            room_id: room_id,
            position: message.data.position,
            item_id: message.data.id
          });
        }
      }
      return callback();
    }
  };
  faye.addExtension(Persistence);
  app.listen(port);
  console.log("Running on port " + port);
}).call(this);
