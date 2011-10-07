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
                url:url
                name:file_name
                hash:hash
            image_exists_serverside url, ->
                # It's already uploaded
                loaded image
            , ->
                # We need to upload it
                upload_file file, item_id, '/upload', (result) ->
                    loaded image
                , ->
                    console.log "error", arguments
                , ->
                    console.log "progress", arguments

            images[hash] = @

class Image
    constructor: ({url:@url, name:@name, hash:@hash}) ->
        images[@hash] = @

DEFAULT_IMAGE_URL = "/uploads/default.gif"

class Thing
    constructor: ({file:@file, position:@position, id:@id, image:@image, url:@url}) ->
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
                url:@url
                client_id:client_id

        if @url
            @node = $ "<img src=\"#{@url}\">"
        else if @file
            @node = $ "<img src=\"#{DEFAULT_IMAGE_URL}\">"
            image_from_file @file, (@image) =>
                @url = @image.url
                @node.attr 'src', @image.url
                socket.publish "/#{ROOM}/set_image_url",
                    id:@id
                    url:@image.name
                    client_id:client_id
            
        $('#play_area').append @node
        @move @position
        @node.draggable
            drag: (event, ui) -> publish_movement ui.offset, false
            stop: (event, ui) -> publish_movement ui.offset, true
        @node.mousedown select_this

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
            url:@url

    set_source: (@source) ->
        @node.attr 'src', @source
            
        
socket = new Faye.Client "/socket"
socket.subscribe "/#{ROOM}/move", ({id,position,client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = things[id]
    thing.move position
    
socket.subscribe "/#{ROOM}/create", ({id, position, url, client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = new Thing
        id:id
        position:position
        url:url or DEFAULT_IMAGE_URL

socket.subscribe "/#{ROOM}/set_image_url", ({id, url, client_id:the_client_id}) ->
    return if the_client_id is client_id
    thing = things[id]
    thing.set_source image_name_to_url url

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
        item.url = image_name_to_url item.url
        new Thing item


upload_file = (file, hash, url, success_handler, error_handler, update_progress_bar) ->
    request = new XMLHttpRequest();
    #monitor_progress(request, update_progress_bar)
    request.upload.addEventListener("error", error_handler, false);

    request.onreadystatechange = ->
        if request.readyState is 4  # DONE
            if request.status is 200 # SUCCESS
                success_handler(request.responseText)
            else # FAILURE
                error_handler(request)

    request.open("POST", url, true); # Last parameter may not be necessary

    form_data = new FormData();
    form_data.append('file', file);
    form_data.append('hash', hash);
    request.send(form_data);
