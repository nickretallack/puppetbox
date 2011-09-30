$ ->
    $('#room-jumper').submit ->
        event.preventDefault()
        room = $('#room').val()
        window.location.pathname = "/play/#{room}"
