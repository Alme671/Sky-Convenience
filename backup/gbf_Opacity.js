// ==UserScript==
// @name         GBF_OPACITY
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  gbf opacity
// @author       Moo_asdsasd5
// @match        *://game.granbluefantasy.jp/
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjZTNlM2UzIj48cGF0aCBkPSJNMjUzLjUtMjEyUTE2MC0zMDQgMTYwLTQzNnEwLTY1IDI1LTEyMS41VDI1NC02NThsMjI2LTIyMiAyMjYgMjIycTQ0IDQ0IDY5IDEwMC41VDgwMC00MzZxMCAxMzItOTMuNSAyMjRUNDgwLTEyMHEtMTMzIDAtMjI2LjUtOTJaTTI0Mi00MDBoNDc0cTEyLTcyLTEzLjUtMTIzVDY1MC02MDBMNDgwLTc2OCAzMTAtNjAwcS0yNyAyNi01MyA3N3QtMTUgMTIzWiIvPjwvc3ZnPg==
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/432201/GBF_OPACITY.user.js
// @updateURL https://update.greasyfork.org/scripts/432201/GBF_OPACITY.meta.js
// ==/UserScript==

(function () {
  "use strict";
  const opacity = GM_getValue("gbf_opacity");
  if (!opacity) {
    GM_setValue("gbf_opacity", 0.5);
  } else {
    GM_addStyle(
      `
           body, #ready { opacity: ${opacity};}
        `,
    );
  }
  const setOpacity = (num) => {
    return () => {
      GM_setValue("gbf_opacity", num);
    };
  };
  GM_registerMenuCommand("OPACITY_0.5", setOpacity(0.5));
  GM_registerMenuCommand("OPACITY_1", setOpacity(1));

  GM_addValueChangeListener("gbf_opacity", (name, ov, nv) => {
    GM_addStyle(
      `
           body, #ready { opacity: ${nv};}
        `,
    );
  });
})();
