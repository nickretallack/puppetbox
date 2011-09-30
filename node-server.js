(function() {
  var Faye, Flow, Guid, Persistence, app, create_item, db, db_uri, delay, express, faye, move_item, move_item_debouncers, persistence_lag, pg, pg_client, port, postgres_point;
  port = 5000;
  db_uri = process.env.PUPPETBOX_DB_URI;
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
  app.get('/play/:room', function(req, res) {
    var room_id, room_name;
    room_name = req.params.room;
    room_id = null;
    return Flow().seq(function(next) {
      return db.query("select * from room where name = $1", [room_name], next);
    }).seq(function(next, result) {
      if (result.rows.length === 0) {
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
    room_id = _arg.room_id, item_id = _arg.item_id, source = _arg.source, position = _arg.position;
    image_id = Guid();
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
  /*
  This is to keep the database from being hammered when someone is interactively moving something.  Unfortunately, putting a lag in here means that users who load the page at an unlucky time may not get all the information they need.  If the user is still dragging the thing while another user loads the page it's fine, since they will definitely receive another drag event or the stop event.  However, if the user has just stopped dragging, no more events will come, and if that stop is not synced to the database yet when somebody loads the page, they will never get the events to place it in the right place.  Therefore, the stop dragging event must bypass the delay, and clear it so that a previous value doesn't end up overwriting the later one.
  
  Then again, I didn't really need all this complexity in the first place because really only stops need to be persisted.  The only time the user will notice the persistence behavior is when they first load the page if things are in the wrong place, and if something is in mid drag and not persisted yet, they will get events that will fix it very soon.
  */
  delay = function(time, action) {
    return setTimeout(action, time);
  };
  persistence_lag = 1000;
  move_item_debouncers = {};
  move_item = function(_arg) {
    var item_id, move_item_query, position, room_id, stopped;
    room_id = _arg.room_id, item_id = _arg.item_id, position = _arg.position, stopped = _arg.stopped;
    move_item_query = function() {
      console.log("moved", JSON.stringify(position));
      return db.query("update item set position = $3\nwhere item.id = $2 and item.room_id = $1", [room_id, item_id, postgres_point(position)], function() {});
    };
    if (move_item_debouncers[item_id]) {
      clearTimeout(move_item_debouncers[item_id]);
    }
    if (stopped) {
      return move_item_query();
    } else {
      return move_item_debouncers[item_id] = delay(persistence_lag, move_item_query);
    }
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
            item_id: message.data.id,
            source: message.data.source,
            position: message.data.position
          });
        }
        if (command === 'move') {
          move_item({
            room_id: room_id,
            position: message.data.position,
            item_id: message.data.id,
            stopped: message.data.stopped
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
