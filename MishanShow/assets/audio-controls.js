(function () {
  "use strict";

  // -----------------------------------------------------------------------
  // This script loads BEFORE the Keynote player (main.js).
  //
  // Strategy:
  // 1. Monkey-patch EventTarget.prototype.addEventListener so that any
  //    handler the Keynote player registers on document or body for click,
  //    touch*, pointer*, gesture*, and contextmenu events is wrapped.
  //    The wrapper checks if the event originated inside our control bar
  //    and, if so, skips the original handler entirely.
  //
  // 2. Render the control bar as a normal div (no iframe needed).
  //
  // 3. Show only one control bar at a time (the most recently playing audio).
  //
  // 4. Intercept the Audio constructor to detect audio playback.
  // -----------------------------------------------------------------------

  // --- Phase 1: Patch addEventListener BEFORE main.js loads ---

  // We'll mark our control bar container with a data attribute
  var MARKER = "data-audio-controls";

  function isInsideControls(event) {
    // Check if the event target (or any ancestor) is our control bar
    var el = event.target;
    while (el) {
      if (el.getAttribute && el.getAttribute(MARKER) !== null) return true;
      el = el.parentNode;
    }
    return false;
  }

  var interceptedEvents = {
    click: true, dblclick: true,
    mousedown: true, mouseup: true, mousemove: true,
    touchstart: true, touchmove: true, touchend: true, touchcancel: true,
    pointerdown: true, pointerup: true, pointermove: true, pointercancel: true,
    gesturestart: true, gesturechange: true, gestureend: true,
    contextmenu: true
  };

  var origAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    // Only wrap handlers on document, document.body, and document.documentElement
    // for the event types that the Keynote player uses for navigation
    if (interceptedEvents[type] &&
        (this === document || this === document.body || this === document.documentElement)) {

      var originalListener = listener;
      var wrappedListener = function (event) {
        if (isInsideControls(event)) {
          // Swallow: don't let the Keynote handler run
          return;
        }
        // Call the original handler with correct `this` context
        if (typeof originalListener === "function") {
          return originalListener.call(this, event);
        } else if (originalListener && typeof originalListener.handleEvent === "function") {
          return originalListener.handleEvent(event);
        }
      };

      return origAddEventListener.call(this, type, wrappedListener, options);
    }

    return origAddEventListener.call(this, type, listener, options);
  };

  // --- Phase 2: Intercept Audio constructor early ---

  var trackedMedia = new WeakSet();
  var activeMedia = null;
  var bar, playBtn, titleEl, curTimeEl, durTimeEl, seekEl, fillEl, thumbEl;
  var animFrameId = null;
  var controlsReady = false;
  var pendingBinds = [];

  var OrigAudio = window.Audio;
  function PatchedAudio(src) {
    var a = new OrigAudio(src);
    a.addEventListener("play", function () { bindMedia(a); });
    a.addEventListener("canplay", function onCanPlay() {
      bindMedia(a);
      a.removeEventListener("canplay", onCanPlay);
    });
    return a;
  }
  PatchedAudio.prototype = OrigAudio.prototype;
  Object.defineProperty(PatchedAudio, "name", { value: "Audio" });
  window.Audio = PatchedAudio;

  // --- Phase 3: Build UI once DOM is ready ---

  function buildUI() {
    if (controlsReady) return;
    controlsReady = true;

    var container = document.createElement("div");
    container.id = "audioControlsContainer";
    container.setAttribute(MARKER, "");
    document.documentElement.appendChild(container);

    var style = document.createElement("style");
    style.textContent =
      "#audioControlsContainer {" +
      "  position: fixed; bottom: 0; left: 0; right: 0;" +
      "  z-index: 999999; pointer-events: none;" +
      "  display: flex; flex-direction: column; align-items: center;" +
      "  gap: 6px; padding: 10px;" +
      "}" +
      ".acb {" +
      "  pointer-events: all;" +
      "  display: flex; align-items: center; gap: 8px;" +
      "  background: rgba(30, 30, 30, 0.92);" +
      "  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);" +
      "  border-radius: 12px; padding: 8px 14px;" +
      "  min-width: 320px; max-width: 500px; width: 60vw;" +
      "  box-shadow: 0 4px 20px rgba(0,0,0,0.5);" +
      "  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;" +
      "  color: #fff; font-size: 13px;" +
      "  transition: opacity 0.3s, transform 0.3s;" +
      "  opacity: 0; transform: translateY(20px);" +
      "  direction: ltr;" +
      "}" +
      ".acb.visible {" +
      "  opacity: 1; transform: translateY(0);" +
      "}" +
      ".acb-btn {" +
      "  background: none; border: none; cursor: pointer;" +
      "  color: #fff; padding: 4px; display: flex;" +
      "  align-items: center; justify-content: center;" +
      "  width: 28px; height: 28px; border-radius: 50%;" +
      "  transition: background 0.15s; flex-shrink: 0;" +
      "}" +
      ".acb-btn:hover { background: rgba(255,255,255,0.15); }" +
      ".acb-btn svg { width: 16px; height: 16px; fill: #fff; }" +
      ".acb-seek {" +
      "  flex: 1; position: relative; height: 20px;" +
      "  display: flex; align-items: center; cursor: pointer;" +
      "}" +
      ".acb-track {" +
      "  width: 100%; height: 4px; background: rgba(255,255,255,0.2);" +
      "  border-radius: 2px; position: relative; overflow: hidden;" +
      "}" +
      ".acb-fill {" +
      "  height: 100%; background: #007AFF; border-radius: 2px;" +
      "  width: 0%;" +
      "}" +
      ".acb-seek:hover .acb-track { height: 6px; }" +
      ".acb-thumb {" +
      "  position: absolute; width: 12px; height: 12px;" +
      "  background: #fff; border-radius: 50%;" +
      "  top: 50%; transform: translate(-50%, -50%);" +
      "  left: 0%; box-shadow: 0 1px 4px rgba(0,0,0,0.4);" +
      "  opacity: 0; transition: opacity 0.15s;" +
      "}" +
      ".acb-seek:hover .acb-thumb { opacity: 1; }" +
      ".acb-time {" +
      "  font-size: 11px; color: rgba(255,255,255,0.7);" +
      "  white-space: nowrap; flex-shrink: 0; min-width: 36px;" +
      "  text-align: center; font-variant-numeric: tabular-nums;" +
      "}" +
      ".acb-title {" +
      "  font-size: 11px; color: rgba(255,255,255,0.5);" +
      "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" +
      "  max-width: 120px; flex-shrink: 0;" +
      "}" +
      "@media (max-width: 480px) {" +
      "  .acb { min-width: 280px; width: 90vw; padding: 6px 10px; }" +
      "  .acb-title { display: none; }" +
      "}";
    document.head.appendChild(style);

    bar = document.createElement("div");
    bar.className = "acb";
    bar.setAttribute(MARKER, "");

    playBtn = document.createElement("button");
    playBtn.className = "acb-btn";
    playBtn.title = "Play/Pause";
    playBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';

    titleEl = document.createElement("span");
    titleEl.className = "acb-title";

    curTimeEl = document.createElement("span");
    curTimeEl.className = "acb-time";
    curTimeEl.textContent = "0:00";

    seekEl = document.createElement("div");
    seekEl.className = "acb-seek";
    seekEl.setAttribute(MARKER, "");

    var track = document.createElement("div");
    track.className = "acb-track";

    fillEl = document.createElement("div");
    fillEl.className = "acb-fill";

    thumbEl = document.createElement("div");
    thumbEl.className = "acb-thumb";

    track.appendChild(fillEl);
    seekEl.appendChild(track);
    seekEl.appendChild(thumbEl);

    durTimeEl = document.createElement("span");
    durTimeEl.className = "acb-time";
    durTimeEl.textContent = "0:00";

    bar.appendChild(playBtn);
    bar.appendChild(titleEl);
    bar.appendChild(curTimeEl);
    bar.appendChild(seekEl);
    bar.appendChild(durTimeEl);
    container.appendChild(bar);

    // --- Event handlers ---

    playBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!activeMedia) return;
      if (activeMedia.paused) activeMedia.play();
      else activeMedia.pause();
    });

    var seeking = false;

    function doSeek(clientX) {
      if (!activeMedia) return;
      var rect = seekEl.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (isFinite(activeMedia.duration) && activeMedia.duration > 0) {
        activeMedia.currentTime = ratio * activeMedia.duration;
      }
    }

    // Use pointer capture so all events stay on seekEl while dragging,
    // even if the pointer leaves the element / control bar area.
    seekEl.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      seeking = true;
      seekEl.setPointerCapture(e.pointerId);
      doSeek(e.clientX);
    });
    seekEl.addEventListener("pointermove", function (e) {
      if (seeking) {
        e.preventDefault();
        doSeek(e.clientX);
      }
    });
    seekEl.addEventListener("pointerup", function (e) {
      if (seeking) {
        seeking = false;
        seekEl.releasePointerCapture(e.pointerId);
      }
    });
    seekEl.addEventListener("pointercancel", function () {
      seeking = false;
    });

    // Process any media elements that were bound before UI was ready
    for (var i = 0; i < pendingBinds.length; i++) {
      bindMedia(pendingBinds[i]);
    }
    pendingBinds = [];

    // Set up MutationObserver
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var nodes = mutations[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          if (node.nodeType !== 1) continue;
          if (node.tagName === "AUDIO" || node.tagName === "VIDEO") {
            (function (el) {
              el.addEventListener("play", function () { bindMedia(el); });
            })(node);
          }
          var els = node.querySelectorAll ? node.querySelectorAll("audio, video") : [];
          for (var k = 0; k < els.length; k++) {
            (function (el) {
              el.addEventListener("play", function () { bindMedia(el); });
            })(els[k]);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    var existing = document.querySelectorAll("audio, video");
    for (var i = 0; i < existing.length; i++) {
      (function (el) {
        el.addEventListener("play", function () { bindMedia(el); });
      })(existing[i]);
    }
  }

  // --- Helpers ---

  var playSVG = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var pauseSVG = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';

  function formatTime(s) {
    if (!isFinite(s) || isNaN(s)) return "0:00";
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function extractTitle(src) {
    if (!src) return "";
    try {
      var decoded = decodeURIComponent(src);
      var name = decoded.split("/").pop();
      name = name.replace(/\.\w+$/, "");
      name = name.replace(/\.\w+-[\d.]+-[\d.]+$/, "");
      return name;
    } catch (e) { return ""; }
  }

  // --- Update loop ---

  function updateUI() {
    if (!activeMedia || !controlsReady) return;
    var pct = 0;
    if (isFinite(activeMedia.duration) && activeMedia.duration > 0) {
      pct = (activeMedia.currentTime / activeMedia.duration) * 100;
    }
    fillEl.style.width = pct + "%";
    thumbEl.style.left = pct + "%";
    curTimeEl.textContent = formatTime(activeMedia.currentTime);
    durTimeEl.textContent = formatTime(activeMedia.duration);
    playBtn.innerHTML = activeMedia.paused ? playSVG : pauseSVG;
    animFrameId = requestAnimationFrame(updateUI);
  }

  function showBar() {
    if (!controlsReady) return;
    bar.classList.add("visible");
    if (!animFrameId) animFrameId = requestAnimationFrame(updateUI);
  }

  function hideBar() {
    if (!controlsReady) return;
    bar.classList.remove("visible");
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  }

  // --- Bind media ---

  function bindMedia(media) {
    if (!controlsReady) {
      if (pendingBinds.indexOf(media) === -1) pendingBinds.push(media);
      return;
    }
    if (trackedMedia.has(media)) return;
    trackedMedia.add(media);

    media.addEventListener("play", function () {
      activeMedia = media;
      var t = extractTitle(media.src || media.currentSrc);
      titleEl.textContent = t;
      titleEl.title = t;
      durTimeEl.textContent = formatTime(media.duration);
      showBar();
    });

    media.addEventListener("pause", function () {
      // keep visible so user can resume
    });

    media.addEventListener("ended", function () {
      if (activeMedia === media) {
        setTimeout(function () {
          if (activeMedia === media && media.ended) hideBar();
        }, 2000);
      }
    });

    media.addEventListener("loadedmetadata", function () {
      if (activeMedia === media) {
        durTimeEl.textContent = formatTime(media.duration);
        var t = extractTitle(media.src || media.currentSrc);
        titleEl.textContent = t;
        titleEl.title = t;
      }
    });

    // If currently playing, show immediately
    if (!media.paused) {
      activeMedia = media;
      var t = extractTitle(media.src || media.currentSrc);
      titleEl.textContent = t;
      titleEl.title = t;
      durTimeEl.textContent = formatTime(media.duration);
      showBar();
    }
  }

  // --- Init UI when DOM is ready ---

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();
