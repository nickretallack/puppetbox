#ROOM = window.location.pathname.slice 1
things = {}
client_id = Guid()

default_position = ->
    left:Mouse.location.x()
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

        if not created
            things[@id] = @
            @node = $ "<img src=\"#{@source}\">"
            $(document.body).append @node
            @node.css
                position:'absolute'
            @move @position
            @node.draggable
                drag: (event, ui) -> publish_movement ui.offset, false
                stop: (event, ui) -> publish_movement ui.offset, true
        else
            socket.publish "/#{ROOM}/create", @toJSON()

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
    thing = new Thing
        id:id
        position:position
        source:source

point_from_postgres = (string) ->
    components = (parseInt component for component in string[1...-1].split ',')
    {left:components[0], top:components[1]}

$ ->
    $("html").pasteImageReader ({filename, dataURL}) ->
        new Thing source:dataURL

    for item in ITEMS
        item.position = point_from_postgres item.position
        new Thing item
