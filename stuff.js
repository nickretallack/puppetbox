(function() {
  var DEFAULT_IMAGE_URL, Image, Inspector, Thing, adjust_position, client_id, default_position, image_exists_serverside, image_from_file, image_name_to_url, images, point_from_postgres, read_file, socket, things, upload_file;
  var __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  }, __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  things = {};
  images = {};
  client_id = Guid();
  adjust_position = function(_arg) {
    var left, top;
    left = _arg.left, top = _arg.top;
    return {
      left: left === 0 ? left : left - 300,
      top: top
    };
  };
  default_position = function() {
    return adjust_position({
      left: Mouse.location.x(),
      top: Mouse.location.y()
    });
  };
  Inspector = {
    current_item: null
  };
  image_exists_serverside = function(url, there, not_there) {
    return $.ajax({
      type: 'head',
      url: url,
      statusCode: {
        200: there,
        404: not_there
      }
    });
  };
  image_name_to_url = function(file_name) {
    return "/uploads/" + file_name;
  };
  image_from_file = function(file, loaded) {
    /* First we read the file into a string so we can make an
    sha256 hash of it.  */    var extension, kind, _ref;
    _ref = file.type.split('/'), kind = _ref[0], extension = _ref[1];
    return read_file(file, 'binary', function(binary) {
      var file_name, hash, image, url;
      hash = SHA256(binary);
      file_name = "" + hash + "." + extension;
      file.name = file_name;
      url = image_name_to_url(file_name);
      if (__indexOf.call(images, hash) >= 0) {
        return loaded(images[hash]);
      } else {
        image = new Image;
        image.url = url;
        images[hash] = image;
        image_exists_serverside(url, function() {
          return loaded(image);
        }, function() {
          return upload_file(file, hash, '/upload', function(result) {
            return loaded(image);
          }, function() {
            return console.log("error", arguments);
          }, function() {
            return console.log("progress", arguments);
          });
        });
        return images[hash] = this;
      }
    });
  };
  Image = (function() {
    function Image() {}
    return Image;
  })();
  DEFAULT_IMAGE_URL = "/uploads/default.gif";
  Thing = (function() {
    function Thing(_arg) {
      var created, publish_movement, ready, select_this, _ref, _ref2;
      this.file = _arg.file, this.position = _arg.position, this.id = _arg.id, ready = _arg.ready;
            if ((_ref = this.position) != null) {
        _ref;
      } else {
        this.position = default_position();
      };
      created = !this.id;
            if ((_ref2 = this.id) != null) {
        _ref2;
      } else {
        this.id = Guid();
      };
      things[this.id] = this;
      publish_movement = __bind(function(offset, stopped) {
        if (stopped == null) {
          stopped = true;
        }
        this.position = adjust_position({
          left: offset.left,
          top: offset.top
        });
        return socket.publish("/" + ROOM + "/move", {
          position: this.position,
          id: this.id,
          client_id: client_id,
          stopped: stopped
        });
      }, this);
      select_this = __bind(function() {
        Inspector.current_item = this;
        return react.changed(Inspector, 'current_item');
      }, this);
      if (created) {
        socket.publish("/" + ROOM + "/create", {
          position: this.position,
          id: this.id,
          client_id: client_id
        });
        this.node = $("<img src=\"" + DEFAULT_IMAGE_URL + "\">");
        $('#play_area').append(this.node);
        this.move(this.position);
        this.node.draggable({
          drag: function(event, ui) {
            return publish_movement(ui.offset, false);
          },
          stop: function(event, ui) {
            return publish_movement(ui.offset, true);
          },
          start: select_this
        });
        this.node.click(select_this);
        image_from_file(this.file, __bind(function(image) {
          this.image = image;
          return this.node.attr('src', this.image.url);
        }, this));
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
    Thing.prototype.destroy = function() {
      this.node.remove();
      return socket.publish("/" + ROOM + "/destroy", {
        id: this.id,
        client_id: client_id
      });
    };
    Thing.prototype.clone = function() {
      var new_position;
      new_position = {
        left: this.position.left + 10,
        top: this.position.top + 10
      };
      return new Thing({
        position: new_position,
        source: this.source
      });
    };
    Thing.prototype.set_source = function(source) {
      this.source = source;
      return this.node.attr('src', this.source);
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
    var id, position, source, the_client_id, thing;
    id = _arg.id, position = _arg.position, source = _arg.source, the_client_id = _arg.client_id;
    if (the_client_id === client_id) {
      return;
    }
    return thing = new Thing({
      id: id,
      position: position,
      source: source
    });
  });
  socket.subscribe("/" + ROOM + "/destroy", function(_arg) {
    var id, the_client_id, thing;
    id = _arg.id, the_client_id = _arg.client_id;
    if (the_client_id === client_id) {
      return;
    }
    thing = things[id];
    return thing.destroy();
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
  read_file = function(file, format_name, callback) {
    var format, formats, reader;
    formats = {
      binary: 'readAsBinaryString',
      url: 'readAsDataUrl'
    };
    format = formats[format_name];
    reader = new FileReader();
    reader.onload = function(event) {
      return callback(event.target.result);
    };
    return reader[format](file);
  };
  $(function() {
    var item, _i, _len, _results;
    react.update({
      node: $('#side_panel')[0],
      scope: Inspector,
      anchor: true
    });
    $("#delete").click(function(event) {
      Inspector.current_item.destroy();
      Inspector.current_item = null;
      return react.changed(Inspector, 'current_item');
    });
    $("#clone").click(function(event) {
      Inspector.current_item = Inspector.current_item.clone();
      return react.changed(Inspector, 'current_item');
    });
    $("html").pasteImageReader(function(file) {
      return new Thing({
        file: file
      });
    });
    _results = [];
    for (_i = 0, _len = ITEMS.length; _i < _len; _i++) {
      item = ITEMS[_i];
      _results.push(item.position = point_from_postgres(item.position));
    }
    return _results;
  });
  upload_file = function(file, hash, url, success_handler, error_handler, update_progress_bar) {
    var form_data, request;
    request = new XMLHttpRequest();
    request.upload.addEventListener("error", error_handler, false);
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (request.status === 200) {
          return success_handler(request.responseText);
        } else {
          return error_handler(request);
        }
      }
    };
    request.open("POST", url, true);
    form_data = new FormData();
    form_data.append('file', file);
    form_data.append('hash', hash);
    return request.send(form_data);
  };
}).call(this);
