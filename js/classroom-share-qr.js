/* Copeak Classroom: share the public login entry, never an authenticated route. */
(function () {
  "use strict";

  var classroomUrl = "https://cc.pic-speak-story.com/";
  var icon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v3M17 21h4M14 21v-2M21 21v-2"/></svg>';
  var libraryPromise;

  function loadQRCode() {
    if (typeof window.QRCode === "function") return Promise.resolve();
    if (libraryPromise) return libraryPromise;
    var urls = [
      "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
      "https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"
    ];
    libraryPromise = new Promise(function (resolve, reject) {
      function tryUrl(index) {
        if (index >= urls.length) { reject(new Error("QR library could not be loaded")); return; }
        var tag = document.createElement("script");
        tag.src = urls[index];
        tag.async = true;
        tag.onload = function () {
          if (typeof window.QRCode === "function") resolve();
          else { tag.remove(); tryUrl(index + 1); }
        };
        tag.onerror = function () { tag.remove(); tryUrl(index + 1); };
        document.head.appendChild(tag);
      }
      tryUrl(0);
    }).catch(function (error) { libraryPromise = null; throw error; });
    return libraryPromise;
  }

  function makeStyle() {
    var style = document.createElement("style");
    style.id = "cc-qr-styles";
    style.textContent = [
      ".cc-qr-trigger{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;min-width:42px;flex:0 0 42px;padding:0;border:1px solid #a9ded0;border-radius:11px;background:#f0fdf8;color:#176b58;box-shadow:0 2px 10px rgba(0,0,0,.1);cursor:pointer;touch-action:manipulation;transition:background .15s,transform .15s;}",
      ".cc-qr-trigger:hover{background:#d8f5e9;transform:translateY(-1px)}",
      ".cc-qr-trigger:focus-visible{outline:3px solid #10b981;outline-offset:3px}",
      ".cc-qr-trigger svg{width:23px;height:23px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
      ".cc-qr-floating{position:fixed;right:calc(14px + env(safe-area-inset-right,0px));top:calc(14px + env(safe-area-inset-top,0px));z-index:1000}",
      ".top-actions>.cc-qr-trigger,.admin-tools>.cc-qr-trigger{order:99;margin-left:2px}",
      "#cc-qr-dialog{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(370px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow-y:auto;padding:0;border:1px solid #dcf3e9;border-radius:20px;background:#fff;color:#193b31;box-shadow:0 30px 90px rgba(7,24,18,.32);z-index:2147483647;font-family:system-ui,-apple-system,'Noto Sans JP',sans-serif;}",
      "#cc-qr-dialog::backdrop{background:rgba(8,22,19,.66);backdrop-filter:blur(3px)}",
      "#cc-qr-dialog .cc-qr-content{padding:22px;text-align:center}",
      "#cc-qr-dialog .cc-qr-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left}",
      "#cc-qr-dialog h2{font-size:19px;line-height:1.4;margin:0;font-weight:850;color:#145b49}",
      "#cc-qr-dialog .cc-qr-close{font-size:25px;border:0;border-radius:9px;background:#edf6f1;color:#285447;width:38px;height:38px;cursor:pointer}",
      "#cc-qr-dialog p{margin:12px 0 15px;font-size:13px;line-height:1.65;color:#567466}",
      "#cc-qr-dialog .cc-qr-canvas{box-sizing:content-box;width:208px;height:208px;padding:14px;max-width:calc(100% - 28px);border:1px solid #e4eee9;background:white;border-radius:12px;margin:0 auto 12px;display:flex;justify-content:center;align-items:center}",
      "#cc-qr-dialog .cc-qr-canvas img,#cc-qr-dialog .cc-qr-canvas canvas{width:208px!important;height:208px!important;max-width:100%;object-fit:contain;image-rendering:pixelated}",
      "#cc-qr-dialog .cc-qr-status{font-size:12px;line-height:1.6;color:#566e63}",
      "#cc-qr-dialog .cc-qr-link{display:block;font-size:12px;overflow-wrap:anywhere;color:#176b58;margin-bottom:15px;text-decoration:underline}",
      "#cc-qr-dialog .cc-qr-copy{width:100%;border:0;border-radius:11px;padding:12px 14px;background:#047857;color:#fff;font-size:14px;font-weight:800;cursor:pointer}",
      "#cc-qr-dialog button:focus-visible,#cc-qr-dialog a:focus-visible{outline:3px solid #10b981;outline-offset:3px}",
      "@media(max-width:560px){.top-actions>.cc-qr-trigger,.admin-tools>.cc-qr-trigger{width:40px;height:40px;min-width:40px;flex-basis:40px}.cc-qr-floating{top:10px;right:10px}}",
      "@media(prefers-reduced-motion:reduce){.cc-qr-trigger{transition:none}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function init() {
    if (document.getElementById("cc-qr-button")) return;
    makeStyle();
    var button = document.createElement("button");
    button.id = "cc-qr-button";
    button.type = "button";
    button.className = "cc-qr-trigger";
    button.setAttribute("aria-label", "Copeak ClassroomのQRコードを表示");
    button.setAttribute("title", "QRコードでClassroomを共有");
    button.innerHTML = icon;

    var actions = document.querySelector(".topbar .top-actions, .admin-header .admin-tools");
    if (actions) {
      actions.appendChild(button);
    } else {
      button.classList.add("cc-qr-floating");
      document.body.appendChild(button);
    }

    var dialog = document.createElement("dialog");
    dialog.id = "cc-qr-dialog";
    dialog.setAttribute("aria-labelledby", "cc-qr-title");
    dialog.innerHTML =
      '<div class="cc-qr-content">' +
        '<div class="cc-qr-heading"><h2 id="cc-qr-title">Copeak Classroomを共有</h2><button type="button" class="cc-qr-close" aria-label="閉じる">×</button></div>' +
        '<p>スマートフォンやiPadで読み取ると、Classroomのログイン画面が開きます。<br>Scan to open Copeak Classroom.</p>' +
        '<div class="cc-qr-canvas" aria-label="ClassroomのログインページへのQRコード" role="img"></div>' +
        '<a class="cc-qr-link" href="' + classroomUrl + '" target="_blank" rel="noopener noreferrer">' + classroomUrl + '</a>' +
        '<button type="button" class="cc-qr-copy">リンクをコピー</button>' +
      '</div>';
    document.body.appendChild(dialog);

    var canvas = dialog.querySelector(".cc-qr-canvas");
    var copy = dialog.querySelector(".cc-qr-copy");
    var previousFocus = null;
    dialog.querySelector(".cc-qr-close").addEventListener("click", function () { dialog.close(); });
    dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", function () { if (previousFocus && previousFocus.focus) previousFocus.focus(); });
    copy.addEventListener("click", async function () {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(classroomUrl);
        copy.textContent = "コピーしました ✓";
      } catch (_) {
        copy.textContent = "上のURLを長押ししてコピーしてください";
      }
    });
    button.addEventListener("click", async function () {
      previousFocus = button;
      copy.textContent = "リンクをコピー";
      canvas.innerHTML = '<span class="cc-qr-status">QRコードを準備しています…</span>';
      if (!dialog.open) dialog.showModal();
      try {
        await loadQRCode();
        if (!dialog.open) return;
        canvas.textContent = "";
        new window.QRCode(canvas, {
          text: classroomUrl, width:208, height:208,
          colorDark:"#173e32", colorLight:"#ffffff",
          correctLevel:window.QRCode.CorrectLevel.M
        });
      } catch (_) {
        canvas.innerHTML = '<span class="cc-qr-status">QRコードを表示できませんでした。<br>下のリンクをご利用ください。</span>';
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
