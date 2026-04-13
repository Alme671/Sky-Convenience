// ==UserScript==
// @name         GBF_RoomFilter
// @namespace    https://github.com/Less01
// @version      1.0.0
// @description  筛选70血以上5人内房间、3人以下的房间、FP房间
// @author       Elma
// @match        *://game.granbluefantasy.jp/
// @match        *://gbf.game.mbga.jp/*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjZTNlM2UzIj48cGF0aCBkPSJNMjAwLTEyMHYtNjQwcTAtMzMgMjMuNS01Ni41VDI4MC04NDBoNDAwcTMzIDAgNTYuNSAyMy41VDc2MC03NjB2NjQwTDQ4MC0yNDAgMjAwLTEyMFptODAtMTIyIDIwMC04NiAyMDAgODZ2LTUxOEgyODB2NTE4Wm0wLTUxOGg0MDAtNDAwWiIvPjwvc3ZnPg==
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/465142/%E7%A2%A7%E8%93%9D%E5%B9%BB%E6%83%B3%E6%95%91%E6%8F%B4%E7%AD%9B%E9%80%89.user.js
// @updateURL https://update.greasyfork.org/scripts/465142/%E7%A2%A7%E8%93%9D%E5%B9%BB%E6%83%B3%E6%95%91%E6%8F%B4%E7%AD%9B%E9%80%89.meta.js
// ==/UserScript==

(function () {
  "use strict";
  // 设定部分
  let opacity = GM_getValue("gbf_assist_opacity", 0.25);
  const curOpacity = GM_getValue("gbf_opacity");
  if (!curOpacity) GM_setValue("gbf_opacity", opacity);
  //HIGH HP,maxplayerCap lowPlayerCap
  let maxPlayerCap = GM_getValue("gbf_assist_playerCount", 5);
  let HPCap = GM_getValue("gbf_assist_enemyHp", 70);
  let lowPlayerCap = 3;
  let EPswitch = GM_getValue("gbf_assist_EPswitch", true);

  // console.log(`Alpha: ${opacity}, 最大人数: ${playerCount}, 最低血量: ${enemyHp}`);

  // 油猴按钮，修改在刷新后生效
  // 可以设定的人数限制为1~9，血量限制为0~90

  GM_registerMenuCommand("EP Mode", () => {
    let EPswitch = GM_getValue("gbf_assist_EPswitch", true);
    GM_setValue("gbf_assist_EPswitch", !EPswitch);
    alert(`EP MODE:${EPswitch ? "OFF" : "ON"}`);
  });

  /*   GM_registerMenuCommand('显示设定并开启', () => { opacity = 0.25; GM_setValue('gbf_assist_opacity', opacity); alert(`Alpha: ${opacity}, 最大人数: ${playerCount}, 最低血量: ${enemyHp}`); });
        GM_registerMenuCommand('关闭', () => { opacity = 1.0; GM_setValue('gbf_assist_opacity', opacity); });
        GM_registerMenuCommand('降低最大人数1', () => { if (playerCount > 1) GM_setValue('gbf_assist_playerCount', --playerCount); });
        GM_registerMenuCommand('提高最大人数1', () => { if (playerCount < 9) GM_setValue('gbf_assist_playerCount', ++playerCount); });
        GM_registerMenuCommand('降低最低血量10', () => { if (enemyHp > 0) GM_setValue('gbf_assist_enemyHp', enemyHp -= 10); });
        GM_registerMenuCommand('提高最低血量10', () => { if (enemyHp < 90) GM_setValue('gbf_assist_enemyHp', enemyHp += 10); }); */

  // 监听页面内容变化，当救援列表改变时修改透明度
  const targetNode = document.querySelector("#wrapper>.contents");
  const config = { childList: true, subtree: true };
  const observer = new MutationObserver((mutationsList) => {
    for (let mutation of mutationsList) {
      // 改为mutation.target.id == "prt-search-list"可以只在救援检索启用
      if (mutation.target.className == "prt-raid-list prt-search-list") {
        let raid_list = mutation.target.querySelectorAll(".btn-multi-raid");
        // console.log(`raid list length: ${raid_list.length}\n`);
        for (let raid of raid_list) {
          let name = raid.querySelector(".txt-raid-name").innerText;
          let playerCount = raid
            .querySelector(".prt-flees-in")
            .innerText.replace(/\/\d+/, "");
          let curHP = raid
            .querySelector(".prt-raid-gauge-inner")
            .getAttribute("style")
            .slice(7, -2);
          let curEP = raid.querySelector(".prt-use-ap").getAttribute("data-ap");
          let maxEP = raid
            .querySelector(".prt-use-ap")
            .getAttribute("data-ap-max");
          //console.log(`name :${name}`);
          //console.log(`count: ${playerCount}, hp: ${curHP}\n`);
          //console.log(`EP: ${curEP}, MAX: ${maxEP}\n,FP:${curEP < maxEP}`);

          /* 大巴
                       黑幕 m > 5的房间、m < 3 且血量小于70的房间
                       保留 m < 3的房间，3 < m < 5 血量大于70的房间 */
          if (name === "Wings of Terror (Impossible)") {
            if (
              playerCount <= lowPlayerCap ||
              (playerCount <= maxPlayerCap && curHP >= HPCap)
            ) {
              continue;
            }
            raid.style.opacity = opacity;
          } else if (curEP === maxEP) {
            /* 其他
                      EPmode开启时 黑幕EP以外房间
                      关闭时 保留 PC < 5 hp > 40 */
            if (!EPswitch && playerCount <= 5 && curHP >= 40) {
              continue;
            }
            raid.style.opacity = opacity;
          }
        }
      }
    }
  });

  // 打开网页时、游戏内跳转时启用
  function run() {
    if (/^#quest\/assist(\/multi\/\d+|\/event)?$/.test(location.hash)) {
      observer.observe(targetNode, config);
      // console.log("observe\n");
    } else {
      observer.disconnect();
      // console.log("disconnect\n");
    }
  }
  run();
  window.addEventListener("hashchange", run);
})();
