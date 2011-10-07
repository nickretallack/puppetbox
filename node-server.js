(function() {
  var Faye, Flow, Guid, Persistence, UPLOAD_DIR, app, create_item, crypto, db, db_uri, delay, delete_item, express, faye, form, fs, hash_big_file, hash_file, move_item, pg, pg_client, port, postgres_point, rsplit, sha256, util;
  port = 5000;
  db_uri = process.env.PUPPETBOX_DB_URI;
  express = require('express');
  Faye = require('faye');
  pg = require('pg');
  db = require('./library/standard/postgres-helper');
  Guid = require('./library/standard/guid').Guid;
  Flow = require('./library/standard/flow');
  form = require('connect-form');
  fs = require('fs');
  crypto = require('crypto');
  util = require('util');
  sha256 = require('./library/standard/sha256').sha256;
  UPLOAD_DIR = "" + __dirname + "/uploads";
  app = express.createServer();
  app.use(express.static(__dirname));
  app.use(form({
    keepExtensions: true
  }));
  app.set('views', __dirname);
  faye = new Faye.NodeAdapter({
    mount: '/socket'
  });
  faye.attach(app);
  pg_client = new pg["native"].Client(db_uri);
  pg_client.connect();
  db.set_db(pg_client);
  app.get('/play/:room', function(request, response) {
    var room_id, room_name;
    room_name = request.params.room;
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
      return db.query("select item.id as id, item.position as position, item.image_id as url from item where item.room_id = $1", [room_id], next);
    }).seq(function(next, result) {
      return response.render('room.ejs', {
        layout: false,
        room: room_id,
        items: JSON.stringify(result.rows)
      });
    });
  });
  rsplit = function(string, delimiter) {
    var split_index;
    split_index = string.lastIndexOf(delimiter);
    return [string.slice(0, split_index), string.slice(split_index)];
  };
  hash_file = function(file, callback) {
    return fs.readFile(file.path, function(error, data) {
      if (error) {
        throw error;
      }
      return callback(sha256(data + ''));
    });
  };
  hash_big_file = function(file, callback) {
    var hash, stream;
    hash = crypto.createHash('sha256');
    stream = fs.createReadStream(file.path, {
      encoding: 'binary'
    });
    stream.addListener('data', function(chunk) {
      var byte, hex, index, _len;
      hash.update(chunk);
      hex = [];
      for (index = 0, _len = chunk.length; index < _len; index++) {
        byte = chunk[index];
        hex.push(chunk.charCodeAt(index).toString(16));
      }
      return console.log(hex.join(' '));
    });
    return stream.addListener('close', function() {
      var digest;
      digest = hash.digest('hex');
      return callback(digest);
    });
  };
  app.post('/upload', function(request, response, next) {
    return request.form.complete(function(error, fields, files) {
      var extension, file, kind, _ref;
      if (error) {
        return next(error);
      }
      if (!(files.file != null)) {
        return;
      }
      file = files.file;
      _ref = file.type.split('/'), kind = _ref[0], extension = _ref[1];
      if (kind === !'image') {
        return response.end("Invalid file type: " + file.type);
      }
      return hash_file(file, function(hash) {
        var new_filename, new_path;
        new_filename = "" + hash + "." + extension;
        new_path = "" + UPLOAD_DIR + "/" + new_filename;
        fs.rename(file.path, new_path);
        console.log("Uploaded a file", new_path);
        return response.end(new_filename);
      });
    });
  });
  create_item = function(_arg) {
    var image_id, item_id, position, room_id;
    room_id = _arg.room_id, item_id = _arg.item_id, position = _arg.position;
    image_id = 'default.gif';
    return Flow().seq(function(next) {
      return db.query("begin", next);
    }).seq(function(next) {
      return db.query("insert into item (id, room_id, image_id, position) \nvalues ($1, $2, $3, $4)", [item_id, room_id, image_id, postgres_point(position)], next);
    }).seq(function(next) {
      return db.query("end", function() {});
    });
  };
  move_item = function(_arg) {
    var item_id, position, room_id, stopped;
    room_id = _arg.room_id, item_id = _arg.item_id, position = _arg.position, stopped = _arg.stopped;
    /* Only persists when movement stops.  Persistence only matters to the user at page load time, so users may see different things for just a moment until another drag or stop event is emitted. */
    if (stopped) {
      return db.query("update item set position = $3\nwhere item.id = $2 and item.room_id = $1", [room_id, item_id, postgres_point(position)], function() {});
    }
  };
  delete_item = function(_arg) {
    var item_id, room_id;
    room_id = _arg.room_id, item_id = _arg.item_id;
    return db.query("delete from item where item.id = $1", [item_id], function() {});
  };
  postgres_point = function(_arg) {
    var left, top;
    left = _arg.left, top = _arg.top;
    return "" + left + "," + top;
  };
  delay = function(time, action) {
    return setTimeout(action, time);
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
        if (command === 'destroy') {
          delete_item({
            room_id: room_id,
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
