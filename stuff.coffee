#ROOM = window.location.pathname.slice 1
things = {}
images = {}
client_id = Guid()

adjust_position = ({left, top}) ->
    left:if left is 0 then left else left - 300
    top:top

default_position = ->
    adjust_position
        left:Mouse.location.x()
        top:Mouse.location.y()

Inspector =
    current_item:null

image_exists_serverside = (url, there, not_there) ->
    $.ajax
        type:'head'
        url:url
        statusCode:
            200: there
            404: not_there

image_name_to_url = (file_name) -> "/uploads/#{file_name}"

image_from_file = (file, loaded) ->
    ### First we read the file into a string so we can make an
    sha256 hash of it.  ###
    [kind, extension] = file.type.split '/'
    read_file file, 'binary', (binary) ->
        hash = SHA256 binary
        file_name = "#{hash}.#{extension}"
        url = image_name_to_url file_name
        if hash in images
            loaded images[hash]
        else
            image = new Image
            image.url = url
            images[hash] = image
            image_exists_serverside url, ->
                # It's already uploaded
                loaded image
            , ->
                # We need to upload it
                upload_file file, '/upload', (result) ->
                    loaded image
                , ->
                    console.log "error", arguments
                , ->
                    console.log "progress", arguments

            images[hash] = @

class Image

DEFAULT_IMAGE_URL = "/uploads/default.gif"

class Thing
    constructor: ({file:@file, position:@position, id:@id, ready:ready}) ->
        @position ?= default_position()
        created = not @id
        @id ?= Guid()
        things[@id] = @

        # TODO: make these methods?
        publish_movement = (offset, stopped=true) =>
            @position = 
                adjust_position
                    left:offset.left
                    top:offset.top
            socket.publish "/#{ROOM}/move",
                position:@position
                id:@id
                client_id:client_id
                stopped:stopped

        select_this = =>
            Inspector.current_item = @
            react.changed Inspector, 'current_item'

        if created
            socket.publish "/#{ROOM}/create", 
                position:@position
                id:@id
                client_id:client_id

            @node = $ "<img src=\"#{DEFAULT_IMAGE_URL}\">"
            $('#play_area').append @node
            @move @position
            @node.draggable
                drag: (event, ui) -> publish_movement ui.offset, false
                stop: (event, ui) -> publish_movement ui.offset, true
                start: select_this
            @node.click select_this

            image_from_file @file, (@image) =>
                @node.attr 'src', @image.src

    toJSON: ->
        position:@position
        id:@id
        source:@source

    move: ({left,top}) ->
        @node.css
            left:left
            top:top

    destroy: ->
        @node.remove()
        socket.publish "/#{ROOM}/destroy", 
            id:@id
            client_id:client_id

    clone: ->
        new_position = 
            left:@position.left + 10
            top:@position.top + 10
        new Thing
            position:new_position
            source:@source

    set_source: (@source) ->
        @node.attr 'src', @source
            
        
socket = new Faye.Client "/socket"
socket.subscribe "/#{ROOM}/move", ({id,position,client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = things[id]
    thing.move position
    
socket.subscribe "/#{ROOM}/create", ({id, position, source, client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = new Thing
        id:id
        position:position
        source:source

socket.subscribe "/#{ROOM}/destroy", ({id, client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = things[id]
    thing.destroy()
    

point_from_postgres = (string) ->
    components = (parseInt component for component in string[1...-1].split ',')
    {left:components[0], top:components[1]}

read_file = (file, format_name, callback) ->
    formats =
        binary:'readAsBinaryString'
        url:'readAsDataUrl'
    format = formats[format_name]
    reader = new FileReader()
    reader.onload = (event) -> callback event.target.result
    reader[format](file)

$ ->
    react.update
        node: $('#side_panel')[0]
        scope: Inspector
        anchor: true

    $("#delete").click (event) ->
        Inspector.current_item.destroy()
        Inspector.current_item = null
        react.changed Inspector, 'current_item'

    $("#clone").click (event) ->
        Inspector.current_item = Inspector.current_item.clone()
        react.changed Inspector, 'current_item'


    $("html").pasteImageReader (file) ->
        new Thing file:file

    for item in ITEMS
        item.position = point_from_postgres item.position
        #new Thing item
