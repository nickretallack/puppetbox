(function() {
  var Thing, default_position, room_name, socket, things;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  room_name = window.location.pathname.slice(1);
  things = {};
  default_position = function() {
    return {
      left: Mouse.location.x(),
      top: Mouse.location.y()
    };
  };
  Thing = (function() {
    function Thing(_arg) {
      var created, _ref, _ref2;
      this.source = _arg.source, this.position = _arg.position, this.id = _arg.id;
      created = !this.id;
            if ((_ref = this.position) != null) {
        _ref;
      } else {
        this.position = default_position();
      };
            if ((_ref2 = this.id) != null) {
        _ref2;
      } else {
        this.id = Guid();
      };
      things[this.id] = this;
      this.node = $("<img src=\"" + this.source + "\">");
      this.node.css({
        position: 'absolute'
      });
      this.move(this.position);
      this.node.draggable({
        drag: __bind(function(event, ui) {
          this.position = {
            left: ui.offset.left,
            top: ui.offset.top
          };
          return socket.emit('move', {
            position: this.position,
            id: this.id
          });
        }, this),
        stop: __bind(function(event, ui) {
          return console.log(event, ui);
        }, this)
      });
      $(document.body).append(this.node);
      if (created) {
        socket.emit('create', this.toJSON());
      }
    }
    Thing.prototype.toJSON = function() {
      return {
        position: this.position,
        id: this.id,
        source: this.source
      };
    };
    Thing.prototype.move = function(_arg) {
      var left, top;
      left = _arg.left, top = _arg.top;
      return this.node.css({
        left: left,
        top: top
      });
    };
    return Thing;
  })();
  socket = io.connect('http://localhost:5000/');
  socket.on('move', function(_arg) {
    var id, position, thing;
    id = _arg.id, position = _arg.position;
    thing = things[id];
    return thing.move(position);
  });
  socket.on('create', function(_arg) {
    var id, position, source, thing;
    id = _arg.id, position = _arg.position, source = _arg.source;
    return thing = new Thing({
      id: id,
      position: position,
      source: source
    });
  });
  $(function() {
    return $("html").pasteImageReader(function(_arg) {
      var dataURL, filename, thing;
      filename = _arg.filename, dataURL = _arg.dataURL;
      return thing = new Thing({
        source: dataURL
      });
    });
  });
}).call(this);
