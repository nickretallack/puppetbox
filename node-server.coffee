port = 5000
# TODO: override this with the environ.  Don't commit it!

db_uri = process.env.PUPPETBOX_DB_URI

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
app.get '/play/:room', (req, res) ->
    # When you load a room, it needs to bootstrap what's in it.
    # TODO: db query that gets all objects in this room
    room_name = req.params.room
    room_id = null

    Flow().seq (next) ->
        db.query "select * from room where name = $1", [room_name], next
    .seq (next, result) ->
        if result.rows.length is 0
            room_id = Guid()
            db.query """insert into room (id, name) values ($1, $2)""", [room_id, room_name], next
        else
            room_id = result.rows[0].id
            next()
    .seq (next) ->
        db.query """select item.id, item.position, image.source from item
            join image on item.room_id = $1 and image.id = item.image_id""", [room_id], next
    .seq (next, result) ->
        res.render 'room.ejs',
            layout:false
            room:room_id,
            items:JSON.stringify result.rows

create_item = ({room_id, item_id, source, position}) ->
    image_id = Guid() # TODO: test for duplicate image
    Flow().seq (next) ->
        db.query "begin", next
    .seq (next) ->
        db.query """insert into image (id, source) values ($1, $2)""", 
            [image_id, source], next
    .seq (next) ->
        db.query """insert into item (id, room_id, image_id, position) 
            values ($1, $2, $3, $4)""",
            [item_id, room_id, image_id, postgres_point position], next
    .seq (next) ->
        db.query "end", ->

###
This is to keep the database from being hammered when someone is interactively moving something.  Unfortunately, putting a lag in here means that users who load the page at an unlucky time may not get all the information they need.  If the user is still dragging the thing while another user loads the page it's fine, since they will definitely receive another drag event or the stop event.  However, if the user has just stopped dragging, no more events will come, and if that stop is not synced to the database yet when somebody loads the page, they will never get the events to place it in the right place.  Therefore, the stop dragging event must bypass the delay, and clear it so that a previous value doesn't end up overwriting the later one.

Then again, I didn't really need all this complexity in the first place because really only stops need to be persisted.  The only time the user will notice the persistence behavior is when they first load the page if things are in the wrong place, and if something is in mid drag and not persisted yet, they will get events that will fix it very soon.
###

delay = (time, action) -> setTimeout action, time
persistence_lag = 1000 # 1 second
move_item_debouncers = {}
move_item = ({room_id, item_id, position, stopped}) ->
    move_item_query = -> 
        console.log "moved", JSON.stringify position
        db.query """update item set position = $3
            where item.id = $2 and item.room_id = $1""", 
            [room_id, item_id, postgres_point position], ->

    clearTimeout move_item_debouncers[item_id] if move_item_debouncers[item_id]
    if stopped
        move_item_query()
    else
        move_item_debouncers[item_id] = delay persistence_lag, move_item_query
        

postgres_point = ({left,top}) -> "#{left},#{top}"

# faye filters
Persistence = 
    incoming: (message, the_callback) ->
        callback = -> the_callback message
        [x, room_id, command] = message.channel.split '/'
        if room_id isnt 'meta'
            if command is 'create'
                create_item
                    room_id:room_id
                    item_id:message.data.id
                    source:message.data.source
                    position:message.data.position
            if command is 'move'
                move_item
                    room_id:room_id
                    position:message.data.position
                    item_id:message.data.id
                    stopped:message.data.stopped
        callback()

faye.addExtension Persistence

app.listen port
console.log "Running on port #{port}"
