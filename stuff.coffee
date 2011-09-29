things = {}

default_position = ->
    left:Mouse.location.x()
    top:Mouse.location.y()


class Thing
    constructor: ({source:@source, position:@position, id:@id}) ->
        created = not @id
        @position ?= default_position()
        @id ?= Guid()
        things[@id] = @
        #image = new Image
        #image.source = @source
        #@node = $ image
        @node = $ "<img src=\"#{@source}\">"
        @node.css
            position:'absolute'
        @move @position
        @node.draggable
            drag: (event, ui) =>
                @position = 
                    left:ui.offset.left
                    top:ui.offset.top
                socket.emit 'move',
                    position:@position
                    id:@id
            stop: (event, ui) =>
                console.log event, ui
        $(document.body).append @node

        socket.emit 'create', @toJSON() if created

    toJSON: ->
        position:@position
        id:@id
        source:@source

    move: ({left,top}) ->
        @node.css
            left:left
            top:top
        
socket = io.connect 'http://localhost:5000/'
socket.on 'move', ({id,position}) ->
    thing = things[id]
    thing.move position
    
socket.on 'create', ({id, position, source}) ->
    thing = new Thing
        id:id
        position:position
        source:source

$ ->
    $("html").pasteImageReader ({filename, dataURL}) ->
        thing = new Thing source:dataURL
