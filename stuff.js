(function() {
  var Thing, client_id, default_position, get_data_url, point_from_postgres, socket, things;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  things = {};
  client_id = Guid();
  default_position = function() {
    return {
      left: Mouse.location.x() - 300,
      top: Mouse.location.y()
    };
  };
  Thing = (function() {
    function Thing(_arg) {
      var created, publish_movement, _ref, _ref2;
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
      publish_movement = __bind(function(offset, stopped) {
        if (stopped == null) {
          stopped = true;
        }
        this.position = {
          left: offset.left,
          top: offset.top
        };
        return socket.publish("/" + ROOM + "/move", {
          position: this.position,
          id: this.id,
          client_id: client_id,
          stopped: stopped
        });
      }, this);
      things[this.id] = this;
      this.node = $("<img src=\"" + this.source + "\">");
      $('#play_area').append(this.node);
      this.node.css({
        position: 'absolute'
      });
      this.move(this.position);
      this.node.draggable({
        drag: function(event, ui) {
          return publish_movement(ui.offset, false);
        },
        stop: function(event, ui) {
          return publish_movement(ui.offset, true);
        }
      });
      this.node.click(__bind(function() {
        return $('#current_image').attr({
          src: this.source
        });
      }, this));
      if (created) {
        socket.publish("/" + ROOM + "/create", {
          position: this.position,
          id: this.id,
          source: this.source,
          client_id: client_id
        });
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
  socket = new Faye.Client("/socket");
  socket.subscribe("/" + ROOM + "/move", function(_arg) {
    var id, position, the_client_id, thing;
    id = _arg.id, position = _arg.position, the_client_id = _arg.client_id;
    if (the_client_id === client_id) {
      return;
    }
    thing = things[id];
    return thing.move(position);
  });
  socket.subscribe("/" + ROOM + "/create", function(_arg) {
    var id, position, source, thing;
    id = _arg.id, position = _arg.position, source = _arg.source;
    if (the_client_id === client_id) {
      return;
    }
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
  get_data_url = function(file, callback) {
    var reader;
    reader = new FileReader();
    reader.onload = function(event) {
      return callback(event.target.result);
    };
    return reader.readAsDataURL(file);
  };
  $(function() {
    var current_image, item, _i, _len, _results;
    current_image = $('#current_image');
    $("html").pasteImageReader(function(file) {
      /* A new file!
      Lets display it using whatever method's faster:
      a data url, or a file upload. */      console.log(file);
      return get_data_url(file, function(data_url) {
        console.log(data_url);
        current_image.attr({
          src: data_url
        });
        return new Thing({
          source: data_url
        });
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
