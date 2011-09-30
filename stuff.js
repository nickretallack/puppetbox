(function() {
  var Thing, default_position, point_from_postgres, socket, things;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
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
      if (!created) {
        things[this.id] = this;
        this.node = $("<img src=\"" + this.source + "\">");
        $(document.body).append(this.node);
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
            return socket.publish("/" + ROOM + "/move", {
              position: this.position,
              id: this.id
            });
          }, this)
        });
      } else {
        socket.publish("/" + ROOM + "/create", this.toJSON());
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
  socket = new Faye.Client("http://localhost:5000/socket");
  socket.subscribe("/" + ROOM + "/move", function(_arg) {
    var id, position, thing;
    id = _arg.id, position = _arg.position;
    thing = things[id];
    return thing.move(position);
  });
  socket.subscribe("/" + ROOM + "/create", function(_arg) {
    var id, position, source, thing;
    id = _arg.id, position = _arg.position, source = _arg.source;
    return thing = new Thing({
      id: id,
      position: position,
      source: source
    });
  });
  point_from_postgres = function(string) {
    var component, components;
    components = (function() {
      var _i, _len, _ref, _results;
      _ref = string.slice(1, -1).split(',');
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        component = _ref[_i];
        _results.push(parseInt(component));
      }
      return _results;
    })();
    return {
      left: components[0],
      top: components[1]
    };
  };
  $(function() {
    var item, _i, _len, _results;
    $("html").pasteImageReader(function(_arg) {
      var dataURL, filename;
      filename = _arg.filename, dataURL = _arg.dataURL;
      return new Thing({
        source: dataURL
      });
    });
    _results = [];
    for (_i = 0, _len = ITEMS.length; _i < _len; _i++) {
      item = ITEMS[_i];
      item.position = point_from_postgres(item.position);
      _results.push(new Thing(item));
    }
    return _results;
  });
}).call(this);
