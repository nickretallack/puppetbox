$ ->
    $("html").pasteImageReader ({filename, dataURL}) ->
        image = new Image
        image.src = dataURL
        $image = $ image
        $image.draggable()
        $(document.body).append $image

    
