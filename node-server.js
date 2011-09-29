(function() {
  var Faye, app, db, db_uri, express, faye, pg, pg_client, port;
  port = 5000;
  db_uri = 'tcp://localhost/puppetbox';
  express = require('express');
  Faye = require('faye');
  pg = require('pg');
  pg_client = new pg.Client(db_uri);
  pg_client.connect();
  db = require('./library/standard/postgres-helper');
  db.set_db(pg_client);
  db.query("select 5", function() {
    return console.log(JSON.stringify(arguments));
  });
  app = express.createServer();
  app.use(express.static(__dirname));
  app.set('views', __dirname);
  faye = new Faye.NodeAdapter({
    mount: '/socket'
  });
  faye.attach(app);
  app.get('/room/:room', function(req, res) {
    return res.render('room.ejs', {
      room: req.params.room,
      layout: false
    });
  });
  app.listen(port);
  console.log("Running on port " + port);
}).call(this);
