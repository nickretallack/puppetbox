port = 5000
# TODO: override this with the environ.  Don't commit it!

db_uri = process.env.PUPPETBOX_DB_URI

express = require 'express'
Faye = require 'faye'
pg = require 'pg'
db = require './library/standard/postgres-helper'
Guid = require('./library/standard/guid').Guid
Flow = require './library/standard/flow'
form = require 'connect-form'
fs = require 'fs'
crypto = require 'crypto'
util = require 'util'
sha256 = require('./library/standard/sha256').sha256
UPLOAD_DIR = "#{__dirname}/uploads"


# set up express
app = express.createServer()
app.use express.static __dirname
app.use form keepExtensions:true
app.set 'views', __dirname

# set up faye
faye = new Faye.NodeAdapter mount:'/socket'
faye.attach app

# set up postgres
pg_client = new pg.native.Client(db_uri)
pg_client.connect()
db.set_db pg_client

# non-static routes
app.get '/play/:room', (request, response) ->
    # When you load a room, it needs to bootstrap what's in it.
    # TODO: db query that gets all objects in this room
    room_name = request.params.room
    room_id = null

    # TODO: this needs some serious work.  Make it separate images from things
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
        db.query """select item.id as id, item.position as position, item.image_id as url from item where item.room_id = $1""", [room_id], next
    .seq (next, result) ->
        response.render 'room.ejs',
            layout:false
            room:room_id,
            items:JSON.stringify result.rows

rsplit = (string, delimiter) ->
    split_index = string.lastIndexOf delimiter
    [string[0...split_index], string[split_index..-1]]

hash_file = (file, callback) ->
    fs.readFile file.path, (error, data) ->
        throw error if error
        callback sha256 data + ''

# unused for now
hash_big_file = (file, callback) ->
    hash = crypto.createHash 'sha256'
    stream = fs.createReadStream file.path,
        encoding:'binary'
    stream.addListener 'data', (chunk) ->
        hash.update chunk

        # lets look at the hex
        hex = []
        for byte, index in chunk
            hex.push chunk.charCodeAt(index).toString 16
        console.log hex.join ' '
    stream.addListener 'close', ->
        digest = hash.digest 'hex'
        callback digest

app.post '/upload', (request, response, next) ->
    request.form.complete (error, fields, files) ->
        return next error if error
        return if not (files.file? and fields.hash?)
        file = files.file
        hash = fields.hash
        [kind, extension] = file.type.split '/'
        return response.end "Invalid file type: #{file.type}" if kind is not 'image'
        new_filename = "#{hash}.#{extension}"
        new_path = "#{UPLOAD_DIR}/#{new_filename}"
        fs.rename file.path, new_path
        console.log "Uploaded a file", new_path
        response.end new_filename
        # TODO: notify us
        # TODO: add to persistence (images table)

            
create_item = ({room_id, item_id, position}) ->
    image_id = 'default.gif'
    Flow().seq (next) ->
        db.query "begin", next
    .seq (next) ->
        db.query """insert into item (id, room_id, image_id, position) 
            values ($1, $2, $3, $4)""",
            [item_id, room_id, image_id, postgres_point position], next
    .seq (next) ->
        db.query "end", ->

move_item = ({room_id, item_id, position, stopped}) ->
    ### Only persists when movement stops.  Persistence only matters to the user at page load time, so users may see different things for just a moment until another drag or stop event is emitted. ###
    if stopped
        db.query """update item set position = $3
            where item.id = $2 and item.room_id = $1""", 
            [room_id, item_id, postgres_point position], ->

delete_item = ({room_id, item_id}) ->
    db.query """delete from item where item.id = $1""", [item_id], ->

set_image_url = ({room_id, item_id, url}) ->
    exists = null
    Flow().seq (next) ->
        db.query "begin", next
    .seq (next) ->
        db.query """select * from image where id = $1""", [url], next
    .seq (next, result) ->
        if result.rows.length is 0
            db.query """insert into image (id) values ($1)""", [url], next
        else next()
    .seq (next) ->
        db.query """update item set image_id = $2 where item.id = $1""", 
            [item_id, url], next
    .seq (next) ->
        db.query "end", ->

postgres_point = ({left,top}) -> "#{left},#{top}"
delay = (time, action) -> setTimeout action, time

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
                    position:message.data.position
            if command is 'move'
                move_item
                    room_id:room_id
                    position:message.data.position
                    item_id:message.data.id
                    stopped:message.data.stopped
            if command is 'destroy'
                delete_item
                    room_id:room_id
                    item_id:message.data.id
            if command is 'set_image_url'
                set_image_url
                    room_id:room_id
                    item_id:message.data.id
                    url:message.data.url
                    
        callback()

faye.addExtension Persistence

app.listen port
console.log "Running on port #{port}"
