(function() {
  $(function() {
    return $('#room-jumper').submit(function() {
      var room;
      event.preventDefault();
      room = $('#room').val();
      return window.location.pathname = "/play/" + room;
    });
  });
}).call(this);
