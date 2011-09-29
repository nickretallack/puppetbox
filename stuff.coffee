room_name = window.location.pathname.slice 1
things = {}

default_position = ->
    left:Mouse.location.x()
    top:Mouse.location.y()

class Thing
    constructor: ({source:@source, position:@position, id:@id}) ->
        created = not @id
        @position ?= default_position()
        @id ?= Guid()

        if not created
            things[@id] = @
            @node = $ "<img src=\"#{@source}\">"
            @node.css
                position:'absolute'
            @move @position
            @node.draggable
                drag: (event, ui) =>
                    @position = 
                        left:ui.offset.left
                        top:ui.offset.top
                    socket.publish "/#{room_name}/move",
                        position:@position
                        id:@id
            $(document.body).append @node

        socket.publish "/#{room_name}/create", @toJSON() if created

    toJSON: ->
        position:@position
        id:@id
        source:@source

    move: ({left,top}) ->
        @node.css
            left:left
            top:top
        
socket = new Faye.Client "http://localhost:5000/socket"
socket.subscribe "/#{room_name}/move", ({id,position}) ->
    thing = things[id]
    thing.move position
    
socket.subscribe "/#{room_name}/create", ({id, position, source}) ->
    thing = new Thing
        id:id
        position:position
        source:source

$ ->
    $("html").pasteImageReader ({filename, dataURL}) ->
        thing = new Thing source:dataURL
