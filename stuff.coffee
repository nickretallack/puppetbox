#ROOM = window.location.pathname.slice 1
things = {}
client_id = Guid()

default_position = ->
    left:Mouse.location.x() - 300
    top:Mouse.location.y()

class Thing
    constructor: ({source:@source, position:@position, id:@id}) ->
        created = not @id
        @position ?= default_position()
        @id ?= Guid()

        publish_movement = (offset, stopped=true) =>
            @position = 
                left:offset.left
                top:offset.top
            socket.publish "/#{ROOM}/move",
                position:@position
                id:@id
                client_id:client_id
                stopped:stopped

        things[@id] = @
        @node = $ "<img src=\"#{@source}\">"
        $('#play_area').append @node
        @node.css
            position:'absolute'
        @move @position
        @node.draggable
            drag: (event, ui) -> publish_movement ui.offset, false
            stop: (event, ui) -> publish_movement ui.offset, true
        @node.click =>
            $('#current_image').attr src:@source

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
        
socket = new Faye.Client "/socket"
socket.subscribe "/#{ROOM}/move", ({id,position,client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = things[id]
    thing.move position
    
socket.subscribe "/#{ROOM}/create", ({id, position, source}) ->
    return if the_client_id is client_id
    thing = new Thing
        id:id
        position:position
        source:source

point_from_postgres = (string) ->
    components = (parseInt component for component in string[1...-1].split ',')
    {left:components[0], top:components[1]}


get_data_url = (file, callback) ->
    reader = new FileReader()
    reader.onload = (event) -> callback event.target.result
    reader.readAsDataURL(file)

$ ->
    current_image = $('#current_image')

    $("html").pasteImageReader (file) ->
        ### A new file!
        Lets display it using whatever method's faster:
        a data url, or a file upload. ###

        #upload_file
        console.log file
        get_data_url file, (data_url) -> 
            console.log data_url
            current_image.attr src:data_url
            new Thing source:data_url

    for item in ITEMS
        item.position = point_from_postgres item.position
        new Thing item
