(function () {
  "use strict";

  var script = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  var botId = script.getAttribute("data-bot-id");
  var position = script.getAttribute("data-position") || "bottom-right";
  var primaryColor = script.getAttribute("data-color") || "#111827";

  if (!botId) {
    console.warn("[OpenBusinessChat] No data-bot-id provided.");
    return;
  }

  var baseUrl = script.src.replace("/widget.js", "");

  var styles = `
    #obc-widget-btn {
      position: fixed;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: ${primaryColor};
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      z-index: 9998;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #obc-widget-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
    }
    #obc-widget-container {
      position: fixed;
      z-index: 9999;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.2);
      background: white;
      transition: opacity 0.25s, transform 0.25s;
    }
    #obc-widget-container.obc-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(16px) scale(0.95);
    }
    #obc-widget-container.obc-visible {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0) scale(1);
    }
    #obc-widget-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    @media (max-width: 480px) {
      #obc-widget-container {
        bottom: 0 !important;
        right: 0 !important;
        left: 0 !important;
        top: 0 !important;
        border-radius: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    }
  `;

  var styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // Position logic
  var pos = position.split("-");
  var vertical = pos[0]; // bottom or top
  var horizontal = pos[1] || "right"; // right or left
  var btnStyle = (vertical === "bottom" ? "bottom: 20px;" : "top: 20px;") +
    (horizontal === "right" ? "right: 20px;" : "left: 20px;");
  var containerStyle = (vertical === "bottom" ? "bottom: 90px;" : "top: 90px;") +
    (horizontal === "right" ? "right: 20px;" : "left: 20px;") +
    "width: 380px; height: 580px;";

  // Button
  var btn = document.createElement("button");
  btn.id = "obc-widget-btn";
  btn.style.cssText = btnStyle;
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var chatIcon = btn.innerHTML;

  // Container + iframe
  var container = document.createElement("div");
  container.id = "obc-widget-container";
  container.className = "obc-hidden";
  container.style.cssText = containerStyle;

  var iframe = document.createElement("iframe");
  iframe.id = "obc-widget-iframe";
  iframe.src = baseUrl + "/embed/" + botId;
  iframe.title = "Chat";
  iframe.allow = "clipboard-write";
  container.appendChild(iframe);

  var isOpen = false;
  btn.addEventListener("click", function () {
    isOpen = !isOpen;
    container.className = isOpen ? "obc-visible" : "obc-hidden";
    btn.innerHTML = isOpen ? closeIcon : chatIcon;
    btn.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");
  });

  document.body.appendChild(btn);
  document.body.appendChild(container);
})();
