#ROOM = window.location.pathname.slice 1
things = {}
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



class Thing
    constructor: ({file:@file, source:@source, position:@position, id:@id, ready:ready}) ->
        created = not @id
        @position ?= default_position()
        @id ?= Guid()

        #### IF NOT.. SOMETHING
        # load the data url first for quickness
        get_data_url @file, (data_url) ->
            @source = data_url
            client_side_ready data_url
            ready @

        # but also upload the file, since this is quicker for others
        # TODO: skip this if we know we already have this file
        upload_file file, '/upload', (result) ->
            @set_source "/uploads/#{result}"
            @server_side_ready result
        , ->
            console.log "error", arguments
        ,  ->
            console.log "progress", arguments

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

        # Uh oh.  We could be emitting movement events before the thing is actually created.
        # Can we send a preliminary creation message that gets there before the thing is uploaded?
        client_side_ready = (source) ->
            things[@id] = @
            @node = $ "<img src=\"#{@source}\">"
            $('#play_area').append @node
            @node.css
                position:'absolute'
            @move @position
            @node.draggable
                drag: (event, ui) -> publish_movement ui.offset, false
                stop: (event, ui) -> publish_movement ui.offset, true
                start: select_this
            @node.click select_this

        if created
            socket.publish "/#{ROOM}/create", 
                position:@position
                id:@id
                source:@source
                client_id:client_id

    

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


get_data_url = (file, callback) ->
    reader = new FileReader()
    reader.onload = (event) -> callback event.target.result
    reader.readAsDataURL(file)

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
        ### A new file!
        Lets display it using whatever method's faster:
        a data url, or a file upload. ###

        get_data_url file, (data_url) ->
            # Now that I have the data url, I can create an image.
            # This also tells me how large it is.
            # Maybe it also tells me something about if it's a duplicate?


            # Hurr.  Perhaps for simplicity's sake we shouldn't send any creation data
            # until the thing is successfully uploaded...


        ###new Thing
            file:file
            ready: (thing) ->
                Inspector.current_item = thing
                react.changed Inspector, 'current_item'
        ###

    for item in ITEMS
        item.position = point_from_postgres item.position
        #new Thing item
