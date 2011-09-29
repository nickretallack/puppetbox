port = 5000
db_uri = 'tcp://localhost/puppetbox'

express = require 'express'
Faye = require 'faye'
pg = require 'pg'
db = require './library/standard/postgres-helper'
Guid = require('./library/standard/guid').Guid
Flow = require './library/standard/flow'

# set up express
app = express.createServer()
app.use express.static __dirname
app.set 'views', __dirname

# set up faye
faye = new Faye.NodeAdapter mount:'/socket'
faye.attach app

# set up postgres
pg_client = new pg.Client db_uri
pg_client.connect()
db.set_db pg_client

# non-static routes
app.get '/room/:room', (req, res) ->
    # When you load a room, it needs to bootstrap what's in it.
    # TODO: db query that gets all objects in this room
    room_name = req.params.room

    Flow().seq (next) ->
        db.query "select * from room where name = $1", [room_name], next
    .seq (next, result) ->
        if result.rowCount is 0
            room_id = Guid()
            db.query """insert into room (id, name) values ($1, $2)""", [room_id, room_name], ->
                next room_id
        else next result.rows[0].id
    .seq (next, room_id) ->
        console.log room_id

    db.query """select item.id, item.position, image.source from item
        join room on room.id = item.room_id and room.name = $1
        join image on image.id = item.image_id""", [room_name], (result) -> 
            console.log arguments
            res.render 'room.ejs',
                layout:false
                room:room_name,
                items:JSON.stringify result.rows

# faye filters
Persistence = 
    incoming: (message, callback) ->
        [type, room_name, command] = message.channel.split '/'
        if type is 'room'
            if command is 'create'
                # create an item

                image_guid = Guid() # TODO: test for duplicate image
                item_guid = Guid()
                Flow().seq (next) ->
                    db.query "begin", next
                .seq (next) ->
                    db.query """insert into image (id, source) values ($1, $2)""", 
                            [image_guid, message.data.source], next
                .seq (next) ->
                    #db.query """insert into 
                    callback message

faye.addExtension Persistence

app.listen port
console.log "Running on port #{port}"
