/**
 * Live text lines anchored to an AR marker.
 * Register providers to add rows (temperature, transit, etc.) later.
 */
(function () {
  const providers = [];

  window.registerWallLine = function (fn) {
    providers.push(fn);
  };

  function formatTime(date) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  window.registerWallLine(function clock() {
    return formatTime(new Date());
  });

  AFRAME.registerComponent("wall-display", {
    init: function () {
      this.render = this.render.bind(this);
      this._timer = setInterval(this.render, 250);
      this.render();
    },
    remove: function () {
      clearInterval(this._timer);
    },
    render: function () {
      const lines = providers
        .map(function (fn) {
          try {
            return fn();
          } catch (err) {
            console.error("wall-display provider failed", err);
            return null;
          }
        })
        .filter(function (line) {
          return line != null && line !== "";
        });

      this.el.setAttribute("value", lines.join("\n"));
    },
  });
})();
