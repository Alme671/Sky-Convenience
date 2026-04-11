// ==UserScript==
// @name         GBF Auto PY
// @namespace    https://github.com/your-username/gbf-autoReflash
// @version      1.0.0
// @description  Granblue Fantasy 自动刷新辅助 — 检测到指定请求后随机延迟自动后退
// @author       Hachimi
// @match        https://game.granbluefantasy.jp/*
// @match        https://gbf.game.mbga.jp/*
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGhlaWdodD0iMjRweCIgdmlld0JveD0iMCAtOTYwIDk2MCA5NjAiIHdpZHRoPSIyNHB4IiBmaWxsPSIjZTNlM2UzIj48cGF0aCBkPSJNNDgwLTE2MHEtMTM0IDAtMjI3LTkzdC05My0yMjdxMC0xMzQgOTMtMjI3dDIyNy05M3E2OSAwIDEzMiAyOC41VDcyMC02OTB2LTExMGg4MHYyODBINTIwdi04MGgxNjhxLTMyLTU2LTg3LjUtODhUNDgwLTcyMHEtMTAwIDAtMTcwIDcwdC03MCAxNzBxMCAxMDAgNzAgMTcwdDE3MCA3MHE3NyAwIDEzOS00NHQ4Ny0xMTZoODRxLTI4IDEwNi0xMTQgMTczdC0xOTYgNjdaIi8+PC9zdmc+
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// @license      MIT
// @homepage     https://github.com/your-username/gbf-autoReflash
// @supportURL   https://github.com/your-username/gbf-autoReflash/issues
// @downloadURL  https://github.com/your-username/gbf-autoReflash/raw/main/gbf_autoReflash.user.js
// @updateURL    https://github.com/your-username/gbf-autoReflash/raw/main/gbf_autoReflash.user.js
// ==/UserScript==

(function () {
    'use strict';

    // =============================================
    //  内置端点
    // =============================================
    const BUILTIN_ATTACK_PATTERN = 'normal_attack_result.json';

    // =============================================
    //  开关预设
    // =============================================
    const PRESETS = [
        {
            id: 'close',
            label: '关闭',
            desc: 'Close',
            config: { enabled: false, attackEnabled: false, customPattern: '', minDelay: 2000, maxDelay: 5000, cooldown: 3000, notifyOnTrigger: false, debug: false },
        },
        {
            id: 'fast',
            label: '日常',
            desc: '1-2s 自动后退',
            config: { enabled: true, attackEnabled: true, customPattern: '', minDelay: 1000, maxDelay: 2000, cooldown: 4000, notifyOnTrigger: false, debug: false },
        },
        {
            id: 'custom',
            label: '猎金',
            desc: '快速 0.3-1s',
            config: { enabled: true, attackEnabled: true, customPattern: 'ability_result.json,summon_result.json', minDelay: 300, maxDelay: 1000, cooldown: 300, notifyOnTrigger: false, debug: false },
        },
        {
            id: 'debug',
            label: '调试',
            desc: '调试模式',
            config: { enabled: true, attackEnabled: true, customPattern: '', minDelay: 2000, maxDelay: 5000, cooldown: 3000, notifyOnTrigger: true, debug: true },
        }

    ];

    // =============================================
    //  默认配置
    // =============================================
    const DEFAULT_CONFIG = {
        enabled: false,                // 是否启用自动后退
        attackEnabled: true,           // 是否启用普攻结算匹配
        customPattern: '',             // 自定义匹配模式（逗号或换行分隔多个）
        useRegex: false,               // 是否使用正则表达式匹配
        pathOnly: true,                // 仅匹配路径（忽略查询参数）
        minDelay: 1000,                // 最小延迟 (ms)
        maxDelay: 3000,                // 最大延迟 (ms)
        cooldown: 2000,                // 冷却时间 (ms)，防止短时间内重复触发
        autoClick: true,               // 后退后自动点击屏幕（恢复自动攻击）
        autoClickMinDelay: 700,        // 自动点击最小延迟 (ms)
        autoClickMaxDelay: 1400,       // 自动点击最大延迟 (ms)
        idleTimeout: 60000,            // 空闲超时 (ms)，启用后长时间无匹配则通知
        notifyOnTrigger: false,        // 触发时显示桌面通知
        debug: false,                  // 调试模式（记录所有请求）
        maxLogEntries: 50,             // 最大日志条目数
    };

    const SCRIPT_NAME = 'GBF Auto Reflash';
    const VERSION = '1.0.0';
    const STORAGE_KEY = 'gbf_auto_reflash_config';

    // =============================================
    //  存储工具
    // =============================================
    const Storage = {
        load() {
            try {
                const raw = GM_getValue(STORAGE_KEY, null);
                if (raw) {
                    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
                }
            } catch (e) { /* ignore */ }
            return { ...DEFAULT_CONFIG };
        },
        save(config) {
            GM_setValue(STORAGE_KEY, JSON.stringify(config));
        },
    };

    // 加载持久化配置
    let config = Storage.load();

    // 【修复】由于面板被禁用，强制从 DEFAULT_CONFIG 读取自动点击的延迟设置，
    // 避免因为被 Tampermonkey 本地旧缓存覆盖而导致范围不准确
    config.autoClickMinDelay = DEFAULT_CONFIG.autoClickMinDelay;
    config.autoClickMaxDelay = DEFAULT_CONFIG.autoClickMaxDelay;

    // =============================================
    //  日志工具
    // =============================================
    const Logger = {
        _prefix: `[${SCRIPT_NAME}]`,
        info(...args) { if (config.debug) console.log(`%c${this._prefix} ℹ️`, 'color:#89b4fa;font-weight:bold', ...args); },
        warn(...args) { if (config.debug) console.warn(`${this._prefix} ⚠️`, ...args); },
        error(...args) { if (config.debug) console.error(`${this._prefix} ❌`, ...args); },
        debug(...args) { if (config.debug) console.log(`%c${this._prefix} 🐛`, 'color:#a6adc8', ...args); },
    };

    // =============================================
    //  请求日志（内存中保存最近的请求记录）
    //  [已禁用] 面板关闭时无需记录日志
    // =============================================
    /*
    const requestLog = [];

    function addLogEntry(method, url, matched) {
        const entry = {
            time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            method,
            url,
            path: extractPath(url),
            matched,
        };
        requestLog.unshift(entry);
        if (requestLog.length > config.maxLogEntries) {
            requestLog.length = config.maxLogEntries;
        }
        updateLogPanel();
    }
    */

    // =============================================
    //  URL 工具
    // =============================================
    function extractPath(url) {
        try {
            const u = new URL(url, window.location.origin);
            return u.pathname;
        } catch {
            const qIdx = url.indexOf('?');
            return qIdx >= 0 ? url.substring(0, qIdx) : url;
        }
    }

    // =============================================
    //  核心逻辑：请求拦截 & 自动后退
    // =============================================
    let pendingTimer = null;
    let triggerCount = 0;
    let lastMatchedUrl = '';
    let lastTriggerTime = 0;
    let idleTimer = null;           // 空闲检测定时器
    let idleNotified = false;       // 是否已发送过空闲通知
    const sessionStartTime = Date.now(); // 记录挂机启动时间，用于计算疲劳值

    /**
     * 获取所有活跃的匹配模式（普攻 + 自定义）
     */
    function getActivePatterns() {
        const patterns = [];

        // 普攻结算（内置）
        if (config.attackEnabled) {
            patterns.push(BUILTIN_ATTACK_PATTERN);
        }

        // 自定义模式
        if (config.customPattern && config.customPattern.trim()) {
            const customPatterns = config.customPattern
                .split(/[,\n]/)
                .map(p => p.trim())
                .filter(p => p.length > 0);
            patterns.push(...customPatterns);
        }

        return [...new Set(patterns)];
    }

    /**
     * 判断 URL 是否匹配任一触发模式
     */
    function isUrlMatched(url) {
        const patterns = getActivePatterns();
        if (patterns.length === 0) return false;

        const target = config.pathOnly ? extractPath(url) : url;

        for (const pattern of patterns) {
            try {
                if (config.useRegex) {
                    if (new RegExp(pattern).test(target)) return true;
                } else {
                    if (target.includes(pattern)) return true;
                }
            } catch (e) {
                Logger.error(`URL 匹配出错 (pattern: ${pattern}):`, e.message);
            }
        }
        return false;
    }

    // =============================================
    //  反抗检测：时序与走神模型 (Gaussian Dist & Distraction)
    // =============================================

    /**
     * 生成符合正态分布（高斯分布）的随机数
     * 使用 Box-Muller 变换算法
     * @param {number} min 最小值
     * @param {number} max 最大值
     * @param {number} skew 偏度 (默认 1)
     */
    function getGaussianRandom(min, max, skew = 1) {
        let u = 0, v = 0;
        while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
        while (v === 0) v = Math.random();
        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

        num = num / 10.0 + 0.5; // Translate to 0 -> 1
        if (num > 1 || num < 0) num = getGaussianRandom(min, max, skew); // resample between 0 and 1 if out of range
        num = Math.pow(num, skew); // Skew
        num *= max - min; // Stretch to fill range
        num += min; // offset to min
        return Math.floor(num);
    }

    /**
     * 计算疲劳系数 (每运行 15 分钟衰减增加 10% 延迟和走神率)
     */
    function getFatigueMultiplier() {
        if (typeof sessionStartTime === 'undefined') return 1.0;
        const minutesElapsed = (Date.now() - sessionStartTime) / 60000;
        // 每 15 分钟增加 0.1 的倍率，最大不超过 2.0
        let multiplier = 1.0 + Math.floor(minutesElapsed / 15) * 0.1;
        return Math.min(2.0, multiplier);
    }

    /**
     * 随机判定“人类走神事件” (Distraction Rate 本为 4%，随疲劳递增)
     * 用于在计算常规延迟时，偶尔加入1.5s~3s的超长延迟，打破绝对的机器节奏。
     */
    function simulateDistraction(baseDelay, fatigueMultiplier = 1.0) {
        const DISTRACTION_RATE = 0.04 * fatigueMultiplier; // 走神概率被疲劳放大
        if (Math.random() < DISTRACTION_RATE) {
            const extraDistractionDelay = Math.floor(Math.random() * 1500) + 1500;
            Logger.debug(`👀 模拟人类走神 (疲劳倍率: ${fatigueMultiplier.toFixed(2)})，增加额外延迟: ${extraDistractionDelay}ms`);
            return baseDelay + extraDistractionDelay;
        }
        return baseDelay;
    }

    /**
     * 计算随机延迟 (应用高斯分布 + 疲劳机制 + 走神机制)
     */
    function getRandomDelay() {
        const fatigue = getFatigueMultiplier();
        const min = Math.max(0, config.minDelay) * fatigue;
        const max = Math.max(min, config.maxDelay) * fatigue;
        const baseDelay = getGaussianRandom(min, max, 1.2);
        return simulateDistraction(baseDelay, fatigue);
    }

    /**
     * 计算自动点击的随机延迟 (应用高斯分布 + 疲劳机制)
     */
    function getAutoClickDelay() {
        const fatigue = getFatigueMultiplier();
        const min = Math.max(0, config.autoClickMinDelay) * fatigue;
        const max = Math.max(min, config.maxDelay) ? Math.max(min, config.autoClickMaxDelay) * fatigue : min;
        return getGaussianRandom(min, max, 1);
    }

    /**
     * 发送底层的无头 HTTP 信号至本机 Python 伺服器
     */
    function sendLocalSignal(endpoint) {
        try {
            GM_xmlhttpRequest({
                method: "GET",
                url: `http://127.0.0.1:28282${endpoint}`,
                onload: function (response) {
                    // 静默完成
                },
                onerror: function (error) {
                    Logger.error(`⚠️ 前往本地中继站 ${endpoint} 失败! 请检查是否运行了 gbf_macro.py`);
                }
            });
        } catch (e) {
            Logger.error("GM_xmlhttpRequest 调用失败，请确保油猴赋予该权限。");
        }
    }

    /**
     * 发起安全协议的物理点击信号
     */
    function simulateHumanClick() {
        Logger.info('📢 [底层通信] 将在外部环境执行安全物理点击');
        sendLocalSignal("/click");
    }

    /**
     * 触发后退操作
     */
    function scheduleGoBack(matchedUrl) {
        const now = Date.now();
        if (now - lastTriggerTime < config.cooldown) {
            Logger.debug(`冷却中 (${config.cooldown - (now - lastTriggerTime)}ms 剩余)，跳过`);
            return;
        }

        if (pendingTimer) {
            Logger.debug('已有挂起的后退定时器，跳过');
            return;
        }

        lastTriggerTime = now;
        const delay = getRandomDelay();
        lastMatchedUrl = matchedUrl;
        triggerCount++;

        // [已禁用] 面板关闭时无需更新统计
        // const statEl = panelEl?.querySelector('#gbf-ar-stat-count');
        // if (statEl) statEl.textContent = triggerCount;

        Logger.info(`✅ 匹配到请求: ${matchedUrl}`);
        Logger.info(`⏱️ 将在 ${delay}ms 后执行后退 (第 ${triggerCount} 次)`);
        // updateStatus('waiting', `等待后退... ${delay}ms (第 ${triggerCount} 次)`);

        if (config.notifyOnTrigger && typeof GM_notification !== 'undefined') {
            GM_notification({
                title: `${SCRIPT_NAME} — 匹配成功`,
                text: `将在 ${delay}ms 后后退\n${extractPath(matchedUrl)}`,
                timeout: Math.min(delay, 3000),
            });
        }

        pendingTimer = setTimeout(() => {
            pendingTimer = null;
            Logger.info('🔙 呼叫底层物理硬件发出倒退快捷键');
            // 交由外围 Python 利用操作系统的 Browser_Back 发出后退，躲避浏览器的行为审查
            sendLocalSignal("/back");

            // 后退后自动点击
            if (config.autoClick) {
                const clickDelay = getAutoClickDelay();
                Logger.info(`🖱️ 将在 ${clickDelay}ms 后自动点击`);
                setTimeout(() => {
                    simulateHumanClick();
                    // 重置空闲定时器（新一轮等待开始）
                    resetIdleTimer();
                }, clickDelay);
            }
        }, delay);
    }

    // =============================================
    //  空闲检测（验证码/战斗结束 提醒）
    // =============================================
    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        idleNotified = false;

        if (!config.enabled || config.idleTimeout <= 0) return;

        idleTimer = setTimeout(() => {
            // 从存储读取最新配置，防止在其他标签页关闭了脚本但当前标签页仍告警
            const currentConfig = Storage.load();
            if (!currentConfig.enabled || currentConfig.idleTimeout <= 0) return;

            idleNotified = true;
            Logger.warn(`⏰ 已 ${currentConfig.idleTimeout / 1000}s 未检测到匹配请求，可能遇到验证码或战斗已结束`);
            // updateStatus('error', `⏰ ${currentConfig.idleTimeout / 1000}s 无响应 — 请检查游戏`);

            if (typeof GM_notification !== 'undefined') {
                GM_notification({
                    title: `${SCRIPT_NAME} — ⚠️ 空闲警告`,
                    text: `已 ${currentConfig.idleTimeout / 1000}s 未检测到匹配请求\n可能遇到验证码或战斗已结束，请检查游戏`,
                    timeout: 10000,
                });
            }
        }, config.idleTimeout);
    }

    function stopIdleTimer() {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = null;
        }
        idleNotified = false;
    }

    /**
     * 处理拦截到的请求
     */
    function handleInterceptedRequest(method, url) {
        if (!url || typeof url !== 'string') return;

        const matched = config.enabled && isUrlMatched(url);

        // [已禁用] 面板关闭时无需记录日志
        // if (config.debug || matched) {
        //     addLogEntry(method, url, matched);
        // }

        // Logger.debug(`请求: [${method}] ${url}`);

        if (matched) {
            // 重置空闲定时器（有匹配 = 游戏活跃）
            resetIdleTimer();
            scheduleGoBack(url);
        }
    }

    // =============================================
    //  隐蔽拦截工具 (Proxy & toString Spoofing)
    // =============================================

    /**
     * 将对象的方法代理，并且欺骗对 toString() 的检查
     */
    function createAntiDetectionProxy(targetObj, targetMethod, handlerFunction) {
        const originalMethod = targetObj[targetMethod];

        // 使用 Proxy 包装原函数，外界无法通过 === 判断被修改过
        const proxy = new Proxy(originalMethod, {
            apply: function (target, thisArg, argumentsList) {
                return handlerFunction(target, thisArg, argumentsList);
            }
        });

        // 覆盖 toString() 检查，返回 Native Code
        const nativeFunctionString = `function ${targetMethod}() { [native code] }`;
        const toStringProxy = new Proxy(Function.prototype.toString, {
            apply: function (target, thisArg, argumentsList) {
                if (thisArg === proxy || thisArg === originalMethod) {
                    return nativeFunctionString;
                }
                return Reflect.apply(target, thisArg, argumentsList);
            }
        });

        // 劫持代理对象的 toString
        Object.defineProperty(proxy, 'toString', {
            configurable: true,
            enumerable: false,
            writable: false,
            value: toStringProxy
        });

        // 将 Proxy 写回目标对象
        targetObj[targetMethod] = proxy;
        return originalMethod;
    }

    // =============================================
    //  XHR 安全拦截
    // =============================================
    createAntiDetectionProxy(window.XMLHttpRequest.prototype, 'open', function (originalOpen, thisArg, args) {
        const [method, url] = args;
        thisArg._gbf_method = method;
        thisArg._gbf_url = url;

        thisArg.addEventListener('load', function () {
            try { handleInterceptedRequest(this._gbf_method, this._gbf_url); }
            catch (e) { }
        });

        return Reflect.apply(originalOpen, thisArg, args);
    });

    // =============================================
    //  Fetch 安全拦截
    // =============================================
    createAntiDetectionProxy(window, 'fetch', function (originalFetch, thisArg, args) {
        const input = args[0];
        const init = args[1];

        let url = '';
        let method = 'GET';

        if (typeof input === 'string') {
            url = input;
        } else if (input instanceof Request) {
            url = input.url;
            method = input.method || 'GET';
        }

        if (init && init.method) {
            method = init.method;
        }

        return Reflect.apply(originalFetch, thisArg, args).then(response => {
            try { handleInterceptedRequest(method, url); } catch (e) { }
            return response;
        });
    });

    Logger.info(`请求拦截器已安装 (XHR + Fetch)`);


    /**
     * 取消挂起的后退
     */
    function cancelPendingBack() {
        if (pendingTimer) {
            clearTimeout(pendingTimer);
            pendingTimer = null;
            Logger.info('⛔ 已取消挂起的后退操作');
        }
    }

    /**
     * 应用预设配置
     */
    function applyPreset(presetId) {
        const preset = PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        // 合并预设配置
        Object.assign(config, preset.config);
        Storage.save(config);

        Logger.info(`已应用预设: ${preset.label}`);

        // 管理空闲定时器
        if (config.enabled) {
            resetIdleTimer();
        } else {
            cancelPendingBack();
            stopIdleTimer();
        }
    }

    // =============================================
    //  Tampermonkey 菜单
    // =============================================
    function registerMenuCommands() {
        if (typeof GM_registerMenuCommand === 'undefined') return;

        for (const preset of PRESETS) {
            GM_registerMenuCommand(`${preset.label} — ${preset.desc}`, () => {
                applyPreset(preset.id);
            });
        }
    }

    // =============================================
    //  入口
    // =============================================
    function init() {
        Logger.info(`v${VERSION} 启动中...`);
        registerMenuCommands();
        if (config.enabled && getActivePatterns().length > 0) {
            Logger.info(`监控中... (${getActivePatterns().length} 条规则)`);
            resetIdleTimer();
        } else {
            Logger.info('当前未启用自动后退');
        }
        Logger.info('初始化完成 ✅');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
