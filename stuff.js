(function() {
  $(function() {
    return $("html").pasteImageReader(function(_arg) {
      var $image, dataURL, filename, image;
      filename = _arg.filename, dataURL = _arg.dataURL;
      image = new Image;
      image.src = dataURL;
      $image = $(image);
      $image.draggable();
      return $(document.body).append($image);
    });
  });
}).call(this);
