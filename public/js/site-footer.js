(function () {
  var REPO_URL = "https://github.com/romkey/ar-site";

  var footer = document.createElement("footer");
  footer.className = "site-footer";

  var link = document.createElement("a");
  link.href = REPO_URL;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "GitHub";

  var version = document.createElement("span");
  version.className = "site-footer__version";

  footer.appendChild(link);
  footer.appendChild(version);
  document.body.appendChild(footer);

  // Surface the running build so a stale Docker image is obvious at a glance.
  fetch("/version.json", { cache: "no-store" })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (data) {
      if (data && data.version) version.textContent = " · v" + data.version;
    })
    .catch(function () {
      /* version is best-effort */
    });
})();
