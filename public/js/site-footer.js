(function () {
  var REPO_URL = "https://github.com/romkey/ar-site";

  var footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML =
    '<a href="' +
    REPO_URL +
    '" target="_blank" rel="noopener noreferrer">GitHub</a>';

  document.body.appendChild(footer);
})();
