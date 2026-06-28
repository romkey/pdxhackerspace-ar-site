/**
 * Full-screen printer status HUD for printer.html.
 * Reads lines from printer-source.js via getPrinterStatusLines().
 */
(function () {
  var hud = document.getElementById("printer-hud");
  if (!hud) return;

  var nameEl = hud.querySelector(".printer-hud__name");
  var statusEl = hud.querySelector(".printer-hud__status");
  var progressWrap = hud.querySelector(".printer-hud__progress");
  var progressBar = hud.querySelector(".printer-hud__progress-bar");
  var detailsEl = hud.querySelector(".printer-hud__details");

  function parseProgress(text) {
    if (!text) return null;
    var match = String(text).match(/(\d+(?:\.\d+)?)\s*%/);
    if (!match) return null;
    var n = Number(match[1]);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null;
  }

  function classifyStatus(text) {
    if (!text) return "";
    var lower = String(text).toLowerCase();
    if (
      lower.indexOf("unavailable") >= 0 ||
      lower.indexOf("no printer data") >= 0 ||
      lower.indexOf("bad json") >= 0
    ) {
      return "is-error";
    }
    if (
      lower.indexOf("print") >= 0 ||
      lower.indexOf("heat") >= 0 ||
      lower.indexOf("busy") >= 0
    ) {
      return "is-active";
    }
    return "";
  }

  function labelForLine(line) {
    if (/^nozzle:/i.test(line)) return "Nozzle";
    if (/^bed:/i.test(line)) return "Bed";
    if (/^done:/i.test(line)) return "Done";
    if (/^prefix:/i.test(line)) return "Prefix";
    if (/^endpoint:/i.test(line)) return "Endpoint";
    if (/sensor\(s\) unavailable/i.test(line)) return "Warning";
    return null;
  }

  function renderDetail(line) {
    var li = document.createElement("li");
    li.className = "printer-hud__detail";

    var label = labelForLine(line);
    var value = line;
    if (/^done:\s*/i.test(line)) {
      value = line.replace(/^done:\s*/i, "");
    }

    if (/^nozzle:|^bed:/i.test(line)) {
      li.classList.add("printer-hud__detail--temp");
      value = line.replace(/^(nozzle|bed):\s*/i, "");
      label = line.split(":")[0];
    }

    if (/endpoint:|prefix:|sensor\(s\)/i.test(line)) {
      li.classList.add("printer-hud__detail--muted");
    }

    if (label) {
      var labelEl = document.createElement("span");
      labelEl.className = "printer-hud__detail-label";
      labelEl.textContent = label;
      li.appendChild(labelEl);
    }

    var valueEl = document.createElement("span");
    valueEl.textContent = value;
    li.appendChild(valueEl);
    return li;
  }

  function render() {
    if (typeof window.getPrinterStatusLines !== "function") return;

    var lines = window.getPrinterStatusLines().filter(Boolean);
    if (lines.length === 0) return;

    nameEl.textContent = lines[0] || "Printer";

    var statusLine = lines[1] || "";
    statusEl.textContent = statusLine || "—";
    statusEl.className = "printer-hud__status " + classifyStatus(statusLine);

    var progress = parseProgress(statusLine);
    if (progress != null) {
      progressWrap.hidden = false;
      progressBar.style.width = progress + "%";
    } else {
      progressWrap.hidden = true;
      progressBar.style.width = "0%";
    }

    detailsEl.innerHTML = "";
    lines.slice(2).forEach(function (line) {
      detailsEl.appendChild(renderDetail(line));
    });
  }

  window.setPrinterHudVisible = function (visible) {
    hud.classList.toggle("is-visible", !!visible);
  };

  setInterval(render, 250);
  render();
})();
