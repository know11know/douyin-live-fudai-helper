threads.start(function () {
/*
 * 单账号抖音团购福袋辅助脚本（AutoX.js）
 *
 * 上游参考：zzlKevin/tiktok-fudai，Apache-2.0。
 * 独立发布版：基于本地已验证状态机，新增入口图片导入；新增功能验证范围见 README。
 * 此入口为 live，启动确认后执行已识别的免费任务；识别测试入口不点击。
 */

// Private startup trace used to identify blockers without relying on the UI console.
var __startupRunId = String(new Date().getTime()) + "-" + String(Math.floor(Math.random() * 1000000));
var __startupTracePath = null;
var __startupScriptPath = "/sdcard/AutoX/scripts/douyin-live-fudai-helper/runner.js";
try { __startupScriptPath = String(engines.myEngine().getSource()); } catch (e) {}
var __startupTrace = { runId: __startupRunId, scriptPath: __startupScriptPath, checkpoints: [] };
function __startupCheckpoint(name, detail) {
    var row = { name: String(name), at: new Date().toISOString() };
    if (detail !== undefined) row.detail = String(detail);
    __startupTrace.checkpoints.push(row);
    if (__startupTrace.checkpoints.length > 256) __startupTrace.checkpoints.shift();
    try {
        if (__startupTracePath === null) {
            __startupTracePath = String(context.getExternalFilesDir(null).getAbsolutePath()) + "/douyin-live-helper-startup-" + __startupRunId + ".json";
        }
        files.write(__startupTracePath, JSON.stringify(__startupTrace));
    } catch (e) {
        try { console.error("STARTUP_CHECKPOINT_WRITE_FAILED " + name + ": " + e); } catch (_) {}
    }
}
function __threadInfo() {
    try {
        var t = java.lang.Thread.currentThread();
        var loop = android.os.Looper.myLooper();
        var main = android.os.Looper.getMainLooper();
        return JSON.stringify({ name: String(t.getName()), id: String(t.getId()), isMainLooper: loop !== null && loop.equals(main) });
    } catch (e) { return "thread_info_error:" + String(e); }
}
__startupCheckpoint("entry", "thread=" + __threadInfo());
try {
    var __currentEngine = engines.myEngine();
    var __currentEngineId = String(__currentEngine.getId());
    var __allEngines = engines.all();
    var __stoppedStale = [];
    for (var __ei = 0; __ei < __allEngines.length; __ei++) {
        try {
            var __engine = __allEngines[__ei];
            var __engineId = String(__engine.getId());
            var __engineSource = String(__engine.getSource());
            if (__engineId !== __currentEngineId && (__engineSource.replace(/^file:\/\//, "") === __startupScriptPath.replace(/^file:\/\//, ""))) {
                __engine.forceStop();
                __stoppedStale.push(__engineId + ":" + __engineSource);
            }
        } catch (__engineError) { __stoppedStale.push("inspect_error:" + String(__engineError)); }
    }
    __startupCheckpoint("stale_engine_cleanup", "self=" + __currentEngineId + "; total=" + __allEngines.length + "; stopped=" + JSON.stringify(__stoppedStale));
} catch (__cleanupError) { __startupCheckpoint("stale_engine_cleanup_error", String(__cleanupError)); }
__startupCheckpoint("before_auto_call");
auto();
__startupCheckpoint("after_auto_call", (typeof auto.service !== "undefined" && auto.service !== null) ? "service_nonnull" : "service_null_or_unreported");

const CONFIG = {
    mode: (typeof engines.myEngine().execArgv.mode === "string" ? engines.myEngine().execArgv.mode : "live"), // 启动时确认一次，仅处理已识别的免费任务。
    packageName: "com.ss.android.ugc.aweme",

    // 候选项与证据级别见 outputs/README.md。
    shareRecipient: "", // 用户明确指定的唯一分享收件人。
    commentTaskEnabled: true, // 用户已授权按福袋要求发送参与评论。
    startTaskLabels: ["开始观看直播任务 参与抽奖"], // 来自用户描述；手机 UI 树未见过
    taskCompleteLabels: ["观看任务已完成", "任务已完成", "参与成功 等待抽奖", "参与成功 等待开奖"], // 均待实机核对
    bagEntryLabels: ["生活服务-直播-福袋"], // 曾在 UI dump 中读到 Button content-desc
    explicitNoWinLabels: ["很遗憾，未中奖", "很遗憾未中奖", "未抽中奖品"], // 待实机核对
    noWinCloseLabels: ["我知道了"], // 必须与明确未中奖文字同时出现
    winnerLabels: ["恭喜中奖", "恭喜你中奖", "中奖啦"], // 待实机核对；仅用于停止
    blockingLabels: ["立即支付", "确认支付", "支付订单", "现在购买", "去购买", "输入验证码", "请输入验证码", "人机验证", "点击完成验证", "直播已结束"], // 精确阻断项；出现即停

    pollMs: 500,
    actionDisappearTimeoutMs: 5000,
    taskTimeoutMs: 30 * 60 * 1000,
    resultTimeoutMs: 10 * 60 * 1000,
    noWinTextCloseDistancePx: 700,
    nextRoundDelayMs: 3000
};

// Per-emulator recipient configuration; absent configuration keeps the original default.
CONFIG.shareRecipientType = "user";
try {
    var recipientConfigPath = __startupScriptPath.replace(/^file:\/\//, "").replace(/\/[^\/]*$/, "") + "/share-recipient.json";
    if (files.exists(recipientConfigPath)) {
        var recipientSettings = JSON.parse(files.read(recipientConfigPath));
        if (typeof recipientSettings.name === "string" && recipientSettings.name.trim() &&
            (recipientSettings.type === "user" || recipientSettings.type === "group")) {
            CONFIG.shareRecipient = recipientSettings.name.trim();
            CONFIG.shareRecipientType = recipientSettings.type;
        }
    }
} catch (e) { __startupCheckpoint("share_recipient_config_error", String(e)); exit(); }

// Crops are taken from this LDPlayer instance at native 1440x2560; all matches
// use simulator-only templates under the adjacent assets/fudai-1440x2560 folder.
const IMAGE_CONFIG = {
    referenceWidth: 1440,
    referenceHeight: 2560,
    assetDir: __startupScriptPath.replace(/^file:\/\//, "").replace(/\/[^\/]*$/, "") + "/assets/fudai-1440x2560/",
    threshold: 0.93,
    regions: {
        recoveryAvatar: [40, 130, 160, 150],
        bag: [20, 400, 210, 200],
        panel: [500, 890, 440, 150],
        pinkPanel: [360, 800, 900, 220],
        taskRow: [40, 1840, 1360, 300],
        action: [40, 2160, 1360, 250],
        result: [120, 540, 1200, 1400]
    }
};

var importedBagNames = [];
try {
    var importedManifest = IMAGE_CONFIG.assetDir + "imported-bags.json";
    if (files.exists(importedManifest)) {
        var importedList = JSON.parse(files.read(importedManifest));
        if (Array.isArray(importedList)) importedBagNames = importedList.filter(function(n){return /^custom_bag_\d+$/.test(String(n));}).slice(0,8);
    }
} catch (e) { __startupCheckpoint("custom_bag_manifest_error", String(e)); }
var RELEASE_ROOT = __startupScriptPath.replace(/^file:\/\//, "").replace(/\/[^\/]*$/, "");
var entrySupport = require(RELEASE_ROOT + "/lib/entries.js");
var importedEntries = entrySupport.load(files, RELEASE_ROOT);
if (device.width !== 1440 || device.height !== 2560 || context.getResources().getDisplayMetrics().densityDpi !== 640) {
    dialogs.alert("分辨率不匹配", "本发布版仅支持模拟器内部 1440×2560、DPI 640、竖屏。请调整并重启模拟器后再运行；缩放桌面窗口不能改变内部像素。");
    exit();
}
let stopRequested = false;
let visualEvidence = [];
const runLeasePath = String(context.getExternalFilesDir(null).getAbsolutePath()) + "/douyin-live-helper-active-run.txt";
files.write(runLeasePath, __startupRunId);

function log(message) {
    console.log("[团购福袋] " + new Date().toLocaleTimeString() + " " + message);
}

// Append-only action trail complements the rolling startup/classification trace.
var __actionAuditPath = null;
function __auditAction(eventName, label, detail) {
    try {
        if (__actionAuditPath === null) {
            __actionAuditPath = String(context.getExternalFilesDir(null).getAbsolutePath()) + "/douyin-live-helper-actions-" + __startupRunId + ".jsonl";
        }
        var row = { runId: __startupRunId, event: String(eventName), label: String(label), at: new Date().toISOString() };
        if (detail !== undefined) row.detail = detail;
        var writer = new java.io.FileWriter(__actionAuditPath, true);
        writer.write(JSON.stringify(row) + "\n");
        writer.close();
    } catch (e) {
        try { console.error("ACTION_AUDIT_WRITE_FAILED " + eventName + ": " + e); } catch (_) {}
    }
}

function initializeOpenCvForImages() {
    __startupCheckpoint("before_init_opencv");
    try {
        const classLoader = context.getClassLoader();
        if (!classLoader) throw new Error("AutoX context classloader 不可用");
        const openCvLoader = classLoader.loadClass("org.opencv.android.OpenCVLoader");
        const initDebug = openCvLoader.getMethod("initDebug");
        const initialized = !!initDebug.invoke(null);
        log("OpenCV OpenCVLoader.initDebug 返回=" + String(initialized));
        if (initialized !== true) throw new Error("OpenCVLoader.initDebug 未返回 true");
        __startupCheckpoint("after_init_opencv", "true");
        return initialized;
    } catch (e) {
        __startupCheckpoint("init_opencv_error", String(e));
        log("OpenCV 初始化失败，图像识别安全停止：" + e);
        return false;
    }
}

function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function exactWhitespacePattern(label) {
    // Anchor the whole label; only whitespace runs may vary (including newlines).
    return new RegExp("^" + String(label).trim().split(/\s+/).map(escapeRegex).join("\\s+") + "$");
}

function isDouyinForeground() {
    try { return currentPackage() === CONFIG.packageName; }
    catch (e) { return false; }
}

function waitForDouyinForeground(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (stopRequested) return false;
        if (isDouyinForeground()) return true;
        sleep(500);
    }
    log("等待目标抖音前台超时；为避免误操作已停止。");
    return false;
}

function installStopKey() {
    try {
        __startupCheckpoint("before_events_observe_key");
        events.observeKey();
        __startupCheckpoint("after_events_observe_key");
        events.onKeyDown("volume_up", function (event) {
            stopRequested = true;
            log("收到音量+停止键。");
            try { event.consumed = true; } catch (e) {}
        });
        log("停止键已就绪：音量+。");
    } catch (e) {
        log("无法注册音量+停止键：" + e);
    }
}

function checkCanContinue() {
    if (stopRequested) return false;
    if (String(files.read(runLeasePath)) !== __startupRunId) {
        stopRequested = true;
        return false;
    }
    if (!isDouyinForeground()) {
        log("抖音不在前台，暂停点击，等待恢复检测。");
        return false;
    }
    return true;
}

function findExact(labels) {
    // One union query per attribute, instead of four tree scans per label.
    const pattern = new RegExp("^(?:" + labels.map(function (label) {
        return String(label).trim().split(/\s+/).map(escapeRegex).join("\\s+");
    }).join("|") + ")$");
    const selectors = [textMatches(pattern), descMatches(pattern)];
    for (let i = 0; i < selectors.length; i++) {
        let node = null;
        try { node = selectors[i].findOnce(); } catch (e) {}
        if (!node) continue;
        let t = "", d = "";
        try { t = normalize(node.text()); } catch (e) {}
        try { d = normalize(node.desc()); } catch (e) {}
        if (labels.indexOf(t) >= 0 || labels.indexOf(d) >= 0) return node;
    }
    return null;
}

function imageAsset(name) {
    try { var path = name.indexOf("custom_") === 0 ? RELEASE_ROOT + "/custom/entries/" + name + ".png" : IMAGE_CONFIG.assetDir + name + ".png"; return files.exists(path) ? images.read(path) : null; }
    catch (e) { log("图像模板无法读取「" + name + "」：" + e); return null; }
}

function matchImage(frame, name, regionName, threshold) {
    let template = null, cropped = null, scaled = null;
    try {
        const region = Array.isArray(regionName) ? regionName : IMAGE_CONFIG.regions[regionName];
        if (!region || frame.width <= 0 || frame.height <= 0) return null;
        const sx = frame.width / IMAGE_CONFIG.referenceWidth;
        const sy = frame.height / IMAGE_CONFIG.referenceHeight;
        if (Math.abs(sx - sy) > 0.005) {
            log("屏幕宽高比例与模板不符，图像识别安全停止。");
            return null;
        }
        const x = Math.round(region[0] * sx), y = Math.round(region[1] * sy);
        const w = Math.round(region[2] * sx), h = Math.round(region[3] * sy);
        if (x < 0 || y < 0 || x + w > frame.width || y + h > frame.height) return null;
        template = imageAsset(name);
        if (!template) return null;
        scaled = (sx === 1 && sy === 1) ? template : images.scale(template, sx, sy);
        cropped = images.clip(frame, x, y, w, h);
        const result = images.matchTemplate(cropped, scaled, {
            max: 1, level: 0,
            threshold: threshold || IMAGE_CONFIG.threshold
        });
        if (!result || !result.matches || result.matches.length !== 1) return null;
        const point = result.matches[0].point;
        const score = result.matches[0].similarity;
        visualEvidence.push({ name: name, region: regionName, score: score });
        return {
            name: name,
            score: score,
            x: x + point.x + scaled.width / 2,
            y: y + point.y + scaled.height / 2
        };
    } catch (e) {
        log("图像匹配异常「" + name + "」：" + e);
        return null;
    } finally {
        try { if (cropped) cropped.recycle(); } catch (e) {}
        try { if (scaled && scaled !== template) scaled.recycle(); } catch (e) {}
        try { if (template) template.recycle(); } catch (e) {}
    }
}

function findVisualState() {
    visualEvidence = [];
    let frame = null;
    try {
        frame = captureScreen();
        if (!frame) return { kind: "unknown", evidence: [] };
        if (frame.width !== 1440 || frame.height !== 2560) throw new Error("截图尺寸不匹配，停止");
        // High-risk outcomes require two independent visual anchors.
        const noWin = matchImage(frame, "no_win_dialog", "result");
        const noWinAck = noWin && matchImage(frame, "no_win_ack_button", "result");
        if (noWin && noWinAck) return { kind: "no_win", point: noWinAck, evidence: visualEvidence.slice(0) };
        const pinkNoWin = matchImage(frame, "pink_no_win", "result");
        const pinkAck = pinkNoWin && matchImage(frame, "pink_ack", "result");
        if (pinkNoWin && pinkAck) return { kind: "no_win", skin: "pink", point: pinkAck, evidence: visualEvidence.slice(0) };

        // The pink “霸王餐” panel uses different art, task duration and labels.
        // Match independent task/button anchors, never a generic pink button.
        const pinkSuccess = matchImage(frame, "pink_success", "action");
        const pinkComplete = pinkSuccess && matchImage(frame, "pink_complete", "taskRow");
        if (pinkSuccess && pinkComplete) return { kind: "success", skin: "pink", evidence: visualEvidence.slice(0) };
        const pinkStart = matchImage(frame, "pink_start", "action");
        const pinkPending = pinkStart && matchImage(frame, "pink_pending", "taskRow");
        if (pinkStart && pinkPending) return { kind: "start_task", skin: "pink", point: pinkStart, evidence: visualEvidence.slice(0) };
        const pinkWatching = matchImage(frame, "pink_watching", "action");
        const pinkWatchLabel = pinkWatching && matchImage(frame, "pink_watch_label", "taskRow");
        if (pinkWatching && pinkWatchLabel) return { kind: "watching", skin: "pink", evidence: visualEvidence.slice(0) };

        const shareLabel = matchImage(frame, "share_task_label", "taskRow");
        if (shareLabel) {
            var shareCta = matchImage(frame, "share_start_cta", "action");
            if (!shareCta) {
                var shareNode = findExact(["分享直播间", "分享直播间 参与抽奖"]);
                var sharePoint = shareNode && nodeCenter(shareNode);
                if (sharePoint && sharePoint.y >= 2160 && sharePoint.y <= 2410) shareCta = sharePoint;
            }
            if (shareCta) return {kind:"share_task", point:shareCta, evidence:visualEvidence.slice(0)};
        }
        const pinkCommentLabel = CONFIG.commentTaskEnabled && matchImage(frame, "pink_comment_label", "taskRow");
        const pinkCommentCta = pinkCommentLabel && matchImage(frame, "pink_comment_cta", "action");
        if (pinkCommentCta) return {kind:"comment_task", skin:"pink", point:pinkCommentCta, evidence:visualEvidence.slice(0)};
        const commentLabel = CONFIG.commentTaskEnabled && matchImage(frame, "comment_task_label", "taskRow");
        const commentSuccess = commentLabel && matchImage(frame, "participation_success_cta", "action");
        if (commentSuccess) return {kind:"success", task:"comment", evidence:visualEvidence.slice(0)};
        const commentStart = commentLabel && (matchImage(frame, "comment_start_cta", "action") || matchImage(frame, "comment_only_cta", "action"));
        if (commentStart) return {kind:"comment_task", point:commentStart, evidence:visualEvidence.slice(0)};
        const success = matchImage(frame, "participation_success_cta", "action");
        const completeRow = success && matchImage(frame, "watch_complete_row", "taskRow");
        if (success && completeRow) return { kind: "success", evidence: visualEvidence.slice(0) };

        const start = matchImage(frame, "start_watch_cta", "action");
        const pendingRow = start && matchImage(frame, "watch_pending_row", "taskRow");
        if (start && pendingRow) return { kind: "start_task", point: start, evidence: visualEvidence.slice(0) };

        const remaining = matchImage(frame, "watch_remaining_label", "action", IMAGE_CONFIG.threshold);
        const stillPending = remaining && matchImage(frame, "watch_pending_row", "taskRow");
        if (remaining && stillPending) return { kind: "watching", evidence: visualEvidence.slice(0) };

        const panel = matchImage(frame, "panel_title", "panel");
        if (panel) return { kind: "panel_unknown", evidence: visualEvidence.slice(0) };
        const pinkPanel = matchImage(frame, "pink_panel", "pinkPanel");
        if (pinkPanel) return { kind: "panel_unknown", skin: "pink", evidence: visualEvidence.slice(0) };
        for (var importedIndex = 0; importedIndex < importedBagNames.length; importedIndex++) {
            var importedBag = matchImage(frame, importedBagNames[importedIndex], "bag", 0.95);
            if (importedBag) return {kind: "bag_entry", skin: "custom", point: importedBag, evidence: visualEvidence.slice(0)};
        }
        const face = matchImage(frame, "pink_entry_face", "bag");
        const teeth = face && matchImage(frame, "pink_entry_teeth", "bag");
        if (face && teeth && Math.abs(teeth.x - face.x - 31) <= 4 && Math.abs(teeth.y - face.y - 3) <= 4) {
            return { kind: "bag_entry", skin: "pink", point: face, evidence: visualEvidence.slice(0) };
        }
        const pinkBag = matchImage(frame, "pink_bag", "bag");
        if (pinkBag) return { kind: "bag_entry", skin: "pink", point: pinkBag, evidence: visualEvidence.slice(0) };
        for (var ci = 0; ci < importedEntries.length; ci++) {
            var customEntry = importedEntries[ci];
            var customPoint = matchImage(frame, customEntry.id, customEntry.region);
            if (customPoint) return { kind: "bag_entry", point: customPoint, evidence: visualEvidence.slice(0) };
        }
        const bag = matchImage(frame, "bag_icon", "bag");
        if (bag) return { kind: "bag_entry", point: bag, evidence: visualEvidence.slice(0) };
        // Exact accessibility entry survives animation/background changes.
        const entry = findExact(CONFIG.bagEntryLabels);
        if (entry) {
            const p = nodeCenter(entry);
            const r = IMAGE_CONFIG.regions.bag;
            if (p && p.x >= r[0] && p.x < r[0] + r[2] && p.y >= r[1] && p.y < r[1] + r[3]) {
                return { kind: "bag_entry", point: p, evidence: [{ name: "exact_bag_accessibility" }] };
            }
        }
        return { kind: "unknown", evidence: visualEvidence.slice(0) };
    } finally {
        try { if (frame) frame.recycle(); } catch (e) {}
    }
}

function isSafeImageTarget(point, observedPackage, focusedWindow, expectedPackage) {
    if (!point || observedPackage !== expectedPackage || !focusedWindow) return false;
    if (focusedWindow.packageName !== expectedPackage || (!focusedWindow.focused && !focusedWindow.active)) return false;
    const bounds = focusedWindow.bounds;
    if (!bounds || bounds.length !== 4) return false;
    const x = Math.round(point.x), y = Math.round(point.y);
    return x >= bounds[0] && x < bounds[2] && y >= bounds[1] && y < bounds[3];
}

function clickImagePoint(point, label) {
    if (!checkCanContinue()) return false;
    var observedPackage = "<unknown>";
    try { observedPackage = String(currentPackage()); } catch (guardError) { observedPackage = "currentPackage_error:" + String(guardError); }
    var focusedEvidence = null;
    try {
        var svc = auto.service;
        var windows = svc ? svc.getWindows() : null;
        if (windows) {
            for (var wi = 0; wi < windows.size(); wi++) {
                var win = windows.get(wi);
                if (!win.isFocused() && !win.isActive()) continue;
                var root = win.getRoot();
                if (!root) continue;
                var rect = new android.graphics.Rect();
                win.getBoundsInScreen(rect);
                var pkg = String(root.getPackageName());
                focusedEvidence = { packageName: pkg, focused: !!win.isFocused(), active: !!win.isActive(), bounds: [rect.left, rect.top, rect.right, rect.bottom] };
                break;
            }
        }
    } catch (evidenceError) { focusedEvidence = { error: String(evidenceError) }; }
    var x = point ? Math.round(point.x) : -1, y = point ? Math.round(point.y) : -1;
    var safeFocusedTarget = isSafeImageTarget(point, observedPackage, focusedEvidence, CONFIG.packageName);
    __startupCheckpoint("image_click_guard", JSON.stringify({ label: label, point: point ? [x, y] : null, observedPackage: observedPackage, focusedWindow: focusedEvidence, expectedPackage: CONFIG.packageName }));
    if (!safeFocusedTarget) {
        __startupCheckpoint("image_click_guard_rejected", !point ? "no_point" : JSON.stringify({ observedPackage: observedPackage, focusedWindow: focusedEvidence }));
        log("图像点击位置不在抖音活动窗口范围内或前台窗口不匹配，停止：「" + label + "」；currentPackage=" + observedPackage);
        return false;
    }
    if (CONFIG.mode !== "live") {
        log("DRY-RUN：匹配到「" + label + "」，预定位置=" + Math.round(point.x) + "," + Math.round(point.y));
        return true;
    }
    __auditAction("click_before", label, { point: [Math.round(point.x), Math.round(point.y)], observedPackage: observedPackage, focusedWindow: focusedEvidence });
    try {
        __startupCheckpoint("before_image_click", label + " @" + Math.round(point.x) + "," + Math.round(point.y));
        click(Math.round(point.x), Math.round(point.y));
        __auditAction("click_returned", label, { result: "returned" });
        __startupCheckpoint("after_image_click", label);
        log("已点击图像匹配的「" + label + "」。");
        return true;
    } catch (e) {
        __auditAction("click_error", label, { error: String(e) });
        __startupCheckpoint("image_click_error", label + ": " + String(e));
        log("图像匹配点击失败「" + label + "」：" + e);
        return false;
    }
}

function describeNode(node) {
    if (!node) return "<none>";
    let t = "", d = "", b = "";
    try { t = normalize(node.text()); } catch (e) {}
    try { d = normalize(node.desc()); } catch (e) {}
    try { b = String(node.bounds()); } catch (e) {}
    return "text='" + t + "' desc='" + d + "' bounds=" + b;
}

function clickableAncestor(node) {
    let current = node;
    for (let depth = 0; depth < 5 && current; depth++) {
        try {
            if (current.enabled() && current.clickable()) return current;
        } catch (e) {}
        try { current = current.parent(); } catch (e) { current = null; }
    }
    return null;
}

function nodeCenter(node) {
    try {
        const b = node.bounds();
        return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
    } catch (e) { return null; }
}

function nearSameDialog(messageNode, closeNode) {
    const a = nodeCenter(messageNode);
    const b = nodeCenter(closeNode);
    if (!a || !b) return false;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) <= CONFIG.noWinTextCloseDistancePx;
}

function clickExact(node, label) {
    const target = clickableAncestor(node);
    if (!target) {
        log("精确节点没有可点击节点/父节点，停止，不使用坐标点击：" + describeNode(node));
        return false;
    }
    if (CONFIG.mode !== "live") {
        log("DRY-RUN：会点击「" + label + "」；未执行点击。节点：" + describeNode(node));
        return true;
    }
    try {
        if (!target.click()) {
            log("无障碍 click 返回失败：" + label);
            return false;
        }
        log("已点击精确节点「" + label + "」。");
        return true;
    } catch (e) {
        log("点击失败：" + label + "；" + e);
        return false;
    }
}

function scanDryRun() {
    const groups = [
        ["免费任务 CTA（待核对）", CONFIG.startTaskLabels],
        ["任务完成/参与成功（待核对）", CONFIG.taskCompleteLabels],
        ["福袋入口（UI dump 已读到文案）", CONFIG.bagEntryLabels],
        ["明确未中奖（待核对）", CONFIG.explicitNoWinLabels],
        ["未中奖关闭按钮（待核对）", CONFIG.noWinCloseLabels]
    ];
    for (let i = 0; i < groups.length; i++) {
        const node = findExact(groups[i][1]);
        if (node) log("DRY-RUN 匹配「" + groups[i][0] + "」：" + describeNode(node));
    }
    log("DRY-RUN 扫描结束；没有执行任何点击。");
}

function waitFor(labels, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && checkCanContinue()) {
        const blocked = findExact(CONFIG.blockingLabels);
        if (blocked) return { kind: "blocked", node: blocked };
        const won = findExact(CONFIG.winnerLabels);
        if (won) return { kind: "winner", node: won };
        const noWin = findExact(CONFIG.explicitNoWinLabels);
        if (noWin) return { kind: "no_win", node: noWin };
        const match = findExact(labels);
        if (match) return { kind: "match", node: match };
        const visual = findVisualState();
        if (visual.kind === "no_win") return { kind: "no_win", imagePoint: visual.point };
        if (visual.kind === "success" && labels === CONFIG.taskCompleteLabels) return { kind: "match", imageState: visual.kind };
        if (visual.kind === "start_task" && labels === CONFIG.startTaskLabels) return { kind: "match", imagePoint: visual.point };
        if (visual.kind === "bag_entry" && labels === CONFIG.bagEntryLabels) return { kind: "match", imagePoint: visual.point };
        sleep(CONFIG.pollMs);
    }
    return { kind: stopRequested ? "stopped" : "timeout" };
}

function waitUntilGone(labels, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && checkCanContinue()) {
        if (labels === CONFIG.explicitNoWinLabels) {
            if (findVisualState().kind !== "no_win" && !findExact(labels)) return true;
        } else if (labels === CONFIG.startTaskLabels) {
            const visual = findVisualState();
            if (visual.kind !== "start_task" && !findExact(labels)) return true;
        } else if (!findExact(labels)) return true;
        sleep(CONFIG.pollMs);
    }
    return false;
}

function doDryRun() {
    __startupCheckpoint("dryrun_enter");
    installStopKey();
    if (!initializeOpenCvForImages()) return;
    try {
        __startupCheckpoint("before_request_screen_capture");
        if (!requestScreenCapture()) {
            __startupCheckpoint("request_screen_capture_returned", "false");
            log("未取得截图授权；图像识别未运行，保持只读退出。");
            return;
        }
        __startupCheckpoint("request_screen_capture_returned", "true");
    } catch (e) {
        __startupCheckpoint("request_screen_capture_error", String(e));
        log("截图授权失败；图像识别未运行：" + e);
        return;
    }
    __startupCheckpoint("before_wait_for_douyin_foreground");
    if (!waitForDouyinForeground(60000)) return;
    __startupCheckpoint("after_wait_for_douyin_foreground");
    __startupCheckpoint("before_scan_dryrun");
    scanDryRun();
    __startupCheckpoint("after_scan_dryrun");
    __startupCheckpoint("before_find_visual_state");
    const visual = findVisualState();
    __startupCheckpoint("visual_state", JSON.stringify({ kind: visual.kind, matches: visual.evidence || [] }));
    log("DRY-RUN 图像状态：「" + visual.kind + "」。");
}

if (CONFIG.mode === "dry-run") {
    doDryRun();
    exit();
}

if (CONFIG.mode !== "live") {
    log("未知 mode；安全停止。");
    exit();
}

__startupCheckpoint("before_live_confirm");
const liveConfirmed = dialogs.confirm("启动自动参与", "仅在目标抖音直播间运行；脚本打开福袋并参与免费观看任务或发送福袋指定评论，并按分享任务分享给设置的用户或群聊。它不会支付、入团、购物或处理中奖。继续启动？");
__startupCheckpoint("after_live_confirm", String(liveConfirmed));
if (!liveConfirmed) {
    log("未确认真实点击，安全退出。");
    exit();
}

if (!initializeOpenCvForImages()) exit();

try {
    __startupCheckpoint("before_request_screen_capture");
    if (!requestScreenCapture()) {
        __startupCheckpoint("request_screen_capture_returned", "false");
        log("未取得截图授权，安全停止；请在手机屏幕上允许 AutoX 截屏。");
        exit();
    }
    __startupCheckpoint("request_screen_capture_returned", "true");
} catch (e) {
    __startupCheckpoint("request_screen_capture_error", String(e));
    log("截图授权失败，安全停止：" + e);
    exit();
}

__startupCheckpoint("before_install_stop_key");
installStopKey();
__startupCheckpoint("after_install_stop_key");
// Visual control page saves a separate, per-emulator room configuration.
var liveRoomSettings = null;
try {
 var liveRoomPath = __startupScriptPath.replace(/^file:\/\//, "").replace(/\/[^\/]*$/, "") + "/live-room.json";
 if (files.exists(liveRoomPath)) {
  var roomSettings = JSON.parse(files.read(liveRoomPath));
  if (roomSettings.enabled === true && /^\d{10,}$/.test(String(roomSettings.roomId))) liveRoomSettings = roomSettings;
 }
} catch(e) { __startupCheckpoint("live_room_config_error", String(e)); }
var jumpControl = storages.create("fudai-jump-control");
function isJumpPaused() { return jumpControl.get("paused", false) === true; }
var roomMissingSince = 0;
function openSavedRoom() {
 app.startActivity({action:"android.intent.action.VIEW", data:"snssdk1128://live?room_id=" + liveRoomSettings.roomId, packageName:CONFIG.packageName});
}
if (liveRoomSettings && !isJumpPaused()) openSavedRoom();
__startupCheckpoint("before_wait_for_douyin_foreground");
if (!waitForDouyinForeground(60000)) exit();
__startupCheckpoint("after_wait_for_douyin_foreground");
log("LIVE 已由用户确认。状态由固定区域图像双锚点识别；未知状态、中奖和阻断状态均停止点击。");

let clickedStartThisRound = false;
let panelMayBeOpen = false;
let successSeen = false;
let lastPanelOpenAttemptAt = 0;
let panelOpenAttemptsWhileHidden = 0;
let consecutivePanelHiddenBagFrames = 0;
let consecutiveStartFrames = 0;
let startClickAttempts = 0;
let lastStartClickAt = 0;
let commentSentThisRound = false;
let shareSentThisRound = false;
var lastShareAt = 0;
var shareRecordPath = String(context.getExternalFilesDir(null).getAbsolutePath()) + "/fudai-last-share.json";
try { if (files.exists(shareRecordPath)) lastShareAt = Number(JSON.parse(files.read(shareRecordPath)).at) || 0; } catch (e) {}
var lastCommentAt = 0;
var commentRecordPath = String(context.getExternalFilesDir(null).getAbsolutePath()) + "/fudai-last-comment.json";
try { if (files.exists(commentRecordPath)) lastCommentAt = Number(JSON.parse(files.read(commentRecordPath)).at) || 0; } catch (e) {}
function shouldSendComment(sent, completed, lastAt, now) {
    return (!sent || completed) && now - lastAt >= 60000;
}
function shouldStartTask(attempts, clicked, frames, elapsedMs) {
    return attempts < 2 && elapsedMs >= 3000 && (!clicked || frames >= 2);
}
// Follow the room selected by the user; recover only from its search-result card.
var rememberedHost = "", lastHostReadAt = 0, lastRecoveryAttempt = 0;
var searchCandidateKey = "", searchCandidateFrames = 0;
function ownsRun() {
    if (stopRequested) return false;
    try { return String(files.read(runLeasePath)) === __startupRunId; }
    catch (e) { return false; }
}
function hostKey(value) {
    return String(value || "").replace(/[\s·•・.。…【】\[\]（）()：:—_-]/g, "");
}
function matchesRememberedHost(candidate, remembered) {
    var a = hostKey(candidate), b = hostKey(remembered);
    if (!a || b.length < 4 || /(?:\.\.\.|…)/.test(String(remembered))) return false;
    if (a.indexOf(b) >= 0) return true;
    var n = 0; while (n < a.length && n < b.length && a.charAt(n) === b.charAt(n)) n++;
    return n >= Math.max(6, Math.min(10, b.length));
}
function rememberCurrentHost() {
    if (Date.now() - lastHostReadAt < 15000) return;
    lastHostReadAt = Date.now();
    try {
        var nodes = textMatches(/.+/).find(), candidates = [];
        for (var i = 0; i < nodes.size(); i++) {
            var node = nodes.get(i), b = node.bounds(), label = normalize(node.text());
            if (b.left >= device.width * 0.11 && b.left <= device.width * 0.30 &&
                b.top >= device.height * 0.045 && b.bottom <= device.height * 0.12 &&
                label.length >= 4 && !/(看过|认证|直播广场|\.\.\.|…)/.test(label)) candidates.push(label);
        }
        if (candidates.length === 1 && candidates[0] !== rememberedHost) {
            rememberedHost = candidates[0];
            commentSentThisRound = false;
            shareSentThisRound = false;
            clickedStartThisRound = false; successSeen = false; startClickAttempts = 0;
            searchCandidateFrames = 0;
            __auditAction("manual_room_remembered", rememberedHost);
        }
    } catch (e) { __startupCheckpoint("host_read_error", String(e)); }
}
function findSearchLiveEntry() {
    if (!rememberedHost) return null;
    var heading = findExact(["团购直播"]);
    if (!heading || !findExact(["综合"]) || !findExact(["直播"])) return null;
    var hb = heading.bounds();
    if (hb.top < device.height * 0.15 || hb.top > device.height * 0.40) return null;
    var nodes = textMatches(/.+/).find(), matches = [];
    for (var i = 0; i < nodes.size(); i++) {
        var node = nodes.get(i), b = node.bounds(), label = normalize(node.text());
        if (b.left < device.width * 0.20 || b.top < hb.bottom ||
            b.top > hb.bottom + device.height * 0.17 || b.bottom > device.height * 0.49) continue;
        if (!matchesRememberedHost(label, rememberedHost)) continue;
        var x = Math.round((hb.left + b.left) / 2);
        var y = Math.round(b.top + device.height * 0.025);
        if (x < device.width * 0.04 || x > device.width * 0.24 || y <= hb.bottom) continue;
        matches.push({x:x, y:y, host:label});
    }
    return matches.length === 1 ? matches[0] : null;
}
function ensureLiveRoom() {
    if (isJumpPaused()) { roomMissingSince = 0; searchCandidateFrames = 0; return isDouyinForeground(); }
    if (!isDouyinForeground() && !liveRoomSettings) { searchCandidateFrames = 0; return false; }
    var activity = String(currentActivity());
    if (/(?:LivePlayActivity|DialogWithWindowVisibility|SheetBaseDialog)$/.test(activity)) {
        roomMissingSince = 0; rememberCurrentHost(); searchCandidateFrames = 0; return true;
    }
    if (liveRoomSettings) {
        if (isDouyinForeground() && findExact(CONFIG.blockingLabels.concat(CONFIG.winnerLabels))) { stopRequested = true; return false; }
        if (!roomMissingSince) roomMissingSince = Date.now();
        if (Date.now() - roomMissingSince >= 6000 && Date.now() - lastRecoveryAttempt >= 15000 && ownsRun()) {
            lastRecoveryAttempt = Date.now();
            try { openSavedRoom(); __auditAction("saved_link_reentry", String(liveRoomSettings.roomId)); } catch(e) { __startupCheckpoint("room_reentry_error",String(e)); }
        }
        return false;
    }
    // The search heading and matching host are mandatory even if activity names change.
    var entry = findSearchLiveEntry();
    if (!entry) { searchCandidateFrames = 0; return true; }
    if (findExact(CONFIG.blockingLabels.concat(CONFIG.winnerLabels))) { stopRequested = true; return false; }
    var key = entry.host + ":" + entry.x + ":" + entry.y;
    searchCandidateFrames = key === searchCandidateKey ? searchCandidateFrames + 1 : 1;
    searchCandidateKey = key;
    if (searchCandidateFrames < 2 || Date.now() - lastRecoveryAttempt < 5000) return false;
    if (!ownsRun()) return false;
    lastRecoveryAttempt = Date.now();
    if (clickImagePoint(entry, "搜索结果中当前主播的直播头像")) {
        __auditAction("search_room_reentry", rememberedHost, {matchedHost:entry.host, point:[entry.x,entry.y]});
        clickedStartThisRound = false; successSeen = false; startClickAttempts = 0;
        consecutiveStartFrames = 0; consecutivePanelHiddenBagFrames = 0;
    }
    searchCandidateFrames = 0;
    return false;
}
function waitShareNode(labels, timeoutMs) {
    var deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && ownsRun() && isDouyinForeground()) {
        var n = findExact(labels); if (n) return n; sleep(300);
    }
    return null;
}
function onlyNamedRecipientSelected(descriptions, recipient) {
    if (descriptions.length !== 1) return false;
    var parts=String(descriptions[0]).split(/[,，]/).map(function(v){return v.trim();}).filter(function(v){return v && v !== "已选中";});
    return parts.length === 1 && parts[0] === recipient;
}
function findShareSendButton() {
    var lists = [textMatches(/.*发送.*/).find(), descMatches(/.*发送.*/).find(), idMatches(/.*:id\/send$/).find()];
    for (var j=0;j<lists.length;j++) {
        for (var k=0;k<lists[j].size();k++) {
            var node=lists[j].get(k);
            var t=String(node.text() || "").replace(/[^\u4e00-\u9fff]/g, "");
            var d=String(node.desc() || "").replace(/[^\u4e00-\u9fff]/g, "");
            if(t !== "发送" && d !== "发送" && !/:id\/send$/.test(String(node.id() || ""))) continue;
            for(var depth=0;node && depth<4;depth++,node=node.parent()) {
                var b=node.bounds();
                if(b.width()>device.width*0.5 && b.height()<device.height*0.2 &&
                    b.top>device.height*0.55 && b.bottom<=device.height && node.enabled() && node.clickable()) return node;
            }
        }
    }
    return null;
}
function waitShareSendButton() {
    var deadline=Date.now()+20000;
    while (Date.now()<deadline && ownsRun() && isDouyinForeground()) {
        var button=findShareSendButton(); if(button) return button; sleep(300);
    }
    return null;
}
function submitShareTask(point) {
    if (!clickImagePoint(point, "打开福袋分享任务")) return false;
    if (!waitShareNode(["分享给"], 8000)) return false;
    if (!ownsRun()) return false;
    var recipientPattern = new RegExp("^" + escapeRegex(CONFIG.shareRecipient) +
        (CONFIG.shareRecipientType === "group" ? "(?:[（(]\\d+[）)])?" : "") + "$");
    var recipients = textMatches(recipientPattern).find();
    if (recipients.size() !== 1) { log("分享对象不唯一或未找到，保留界面等待处理。"); return false; }
    var existing = descMatches(/.*已选中.*/).find();
    if (existing.size() !== 0) { log("分享面板已有选中对象，本次不发送。"); return false; }
    var recipient = recipients.get(0);
    if (!clickImagePoint(nodeCenter(recipient), "选择分享对象：" + CONFIG.shareRecipient)) return false;
    var sendNode = waitShareSendButton();
    if (!sendNode || !ownsRun()) { __startupCheckpoint("share_send_button_missing", String(currentActivity())); return false; }
    var selected = descMatches(/.*已选中.*/).find(), descriptions = [];
    for (var i=0;i<selected.size();i++) descriptions.push(String(selected.get(i).desc()));
    var recipientVerified = onlyNamedRecipientSelected(descriptions, CONFIG.shareRecipient);
    // Group share cards expose a selected-badge child instead of an updated description.
    if (!recipientVerified && descriptions.length === 0 && CONFIG.shareRecipientType === "group") {
        var badges = idMatches(/.*:id\/lge$/).find();
        var card = recipient.parent(), cardBounds = card && card.bounds();
        if (badges.size() === 1 && cardBounds) {
            var badgeBounds = badges.get(0).bounds();
            recipientVerified = badgeBounds.left >= cardBounds.left && badgeBounds.right <= cardBounds.right &&
                badgeBounds.top >= cardBounds.top && badgeBounds.bottom <= cardBounds.bottom;
            if (recipientVerified) descriptions = ["已选中," + CONFIG.shareRecipient];
        }
    }
    if (!recipientVerified) {
        log("选中收件人与指定用户不一致，本次不发送。"); return false;
    }
    lastShareAt = Date.now();
    try { files.write(shareRecordPath, JSON.stringify({at:lastShareAt, host:rememberedHost, recipient:CONFIG.shareRecipient})); }
    catch (e) { log("分享去重记录保存失败，不发送。"); return false; }
    __auditAction("share_submit", CONFIG.shareRecipient, {host:rememberedHost, selected:descriptions});
    return clickImagePoint(nodeCenter(sendNode), "发送当前直播间给：" + CONFIG.shareRecipient);
}
while (ownsRun()) {
    if (!ensureLiveRoom()) { sleep(500); continue; }
    if (!checkCanContinue()) { sleep(500); continue; }
    __startupCheckpoint("live_loop_iteration");
    __startupCheckpoint("before_blocking_label_scan");
    const blocked = findExact(CONFIG.blockingLabels.concat(CONFIG.winnerLabels));
    __startupCheckpoint("after_blocking_label_scan", blocked ? "matched" : "clear");
    if (blocked) {
        log("出现中奖、付款、验证码或下播文案；停止，不处理该界面。");
        break;
    }

    __startupCheckpoint("before_capture_and_classify");
    let visual;
    try {
        visual = findVisualState();
        __startupCheckpoint("after_capture_and_classify", JSON.stringify({ kind: visual.kind, matches: visual.evidence || [] }));
    } catch (e) {
        __startupCheckpoint("capture_or_classify_error", String(e));
        log("截图或图像识别异常，停止以避免误操作：" + e);
        break;
    }
    if (visual.kind !== "bag_entry") consecutivePanelHiddenBagFrames = 0;
    if (visual.kind !== "start_task") consecutiveStartFrames = 0;
    if (visual.kind === "no_win") {
        __auditAction("state_no_win", "explicit_no_win", { matches: visual.evidence || [] });
        if (!clickImagePoint(visual.point, "我知道了（未中奖弹窗）")) break;
        if (!waitUntilGone(CONFIG.explicitNoWinLabels, CONFIG.actionDisappearTimeoutMs)) {
            log("未中奖弹窗关闭后仍可见；为防重复操作而停止。");
            break;
        }
        log("未中奖弹窗已关闭并经截图核验；等待下一轮福袋。");
        clickedStartThisRound = false;
        startClickAttempts = 0;
        commentSentThisRound = false;
        shareSentThisRound = false;
        panelMayBeOpen = false;
        successSeen = false;
        panelOpenAttemptsWhileHidden = 0;
        sleep(CONFIG.nextRoundDelayMs);
        continue;
    }
    if (visual.kind === "success") {
        if (!successSeen) {
            log("已匹配任务完成行和「参与成功 等待开奖」图像；等待开奖结果。");
            __auditAction("state_success", "participation_success", { matches: visual.evidence || [] });
        }
        successSeen = true;
        startClickAttempts = 0;
        panelMayBeOpen = true;
        panelOpenAttemptsWhileHidden = 0;
    } else if (visual.kind === "share_task") {
        if (!CONFIG.shareRecipient) { stopRequested = true; log("请先配置分享收件人 share-recipient.json"); continue; }
        panelMayBeOpen = true; panelOpenAttemptsWhileHidden = 0;
        if ((!shareSentThisRound || successSeen) && Date.now() - lastShareAt >= 60000) {
            shareSentThisRound = true; successSeen = false;
            if (!submitShareTask(visual.point)) {
                log("分享未完成或结果不确定，保留现场并停止，避免误发或重复发。"); break;
            }
            panelMayBeOpen = false;
        }
    } else if (visual.kind === "comment_task") {
        panelMayBeOpen = true; panelOpenAttemptsWhileHidden = 0;
        if (shouldSendComment(commentSentThisRound, successSeen, lastCommentAt, Date.now())) {
            // Mark before clicking: failed or uncertain submissions must not produce repeated comments.
            lastCommentAt = Date.now(); commentSentThisRound = true; successSeen = false;
            try { files.write(commentRecordPath, JSON.stringify({at:lastCommentAt, host:rememberedHost})); }
            catch (e) { log("评论去重记录保存失败，本次不发送：" + e); continue; }
            __auditAction("comment_task_submit", "福袋指定评论", {host:rememberedHost, matches:visual.evidence || []});
            if (!clickImagePoint(visual.point, "发送评论 参与抽奖（福袋指定内容）")) break;
            log("已点击评论参与，等待完成状态；同轮不重复发送。");
        }
    } else if (visual.kind === "start_task") {
        consecutiveStartFrames++;
        if (successSeen) {
            __auditAction("round_reset", "new_start_task_after_success", { matches: visual.evidence || [] });
            successSeen = false;
            clickedStartThisRound = false;
        }
        panelMayBeOpen = true;
        panelOpenAttemptsWhileHidden = 0;
        const shouldStart = shouldStartTask(startClickAttempts, clickedStartThisRound,
            consecutiveStartFrames, Date.now() - lastStartClickAt);
        if (shouldStart) {
            if (!clickImagePoint(visual.point, CONFIG.startTaskLabels[0])) break;
            clickedStartThisRound = true;
            startClickAttempts++;
            lastStartClickAt = Date.now();
            log("已点击开始任务；倒计时出现后不再点击，未生效最多重试一次。");
        }
    } else if (visual.kind === "watching") {
        startClickAttempts = 0;
        panelMayBeOpen = true;
        panelOpenAttemptsWhileHidden = 0;
        clickedStartThisRound = true;
        log("观看倒计时仍在运行；等待，不重复点击开始按钮。");
    } else if (visual.kind === "panel_unknown") {
        panelMayBeOpen = true;
        panelOpenAttemptsWhileHidden = 0;
    } else if (visual.kind === "bag_entry") {
        // bag_entry is returned only when the fixed panel-title template is
        // absent and the bag icon is present. Require that classification in
        // two consecutive captures before treating panelMayBeOpen as stale.
        // Retry indefinitely while the entry remains positively identified.
        // Keep a cooldown and never reset this round's CTA click guard here.
        panelMayBeOpen = false;
        consecutivePanelHiddenBagFrames++;
        __startupCheckpoint("panel_hidden_candidate", JSON.stringify({ consecutiveFrames: consecutivePanelHiddenBagFrames, bag: visual.evidence || [] }));
        if (consecutivePanelHiddenBagFrames >= 2 && Date.now() - lastPanelOpenAttemptAt >= 3000) {
            panelOpenAttemptsWhileHidden++;
            lastPanelOpenAttemptAt = Date.now();
            __auditAction("panel_reopen", "bag_entry", { attempt: panelOpenAttemptsWhileHidden, matches: visual.evidence || [], successSeen: successSeen, clickedStartThisRound: clickedStartThisRound });
            if (!clickImagePoint(visual.point, "团购福袋入口（面板已收起后重新打开）")) {
                consecutivePanelHiddenBagFrames = 0;
                log("本次入口点击未成功；保留任务状态，等待重新识别后再试。");
                sleep(3000);
                continue;
            }
            panelMayBeOpen = true;
            consecutivePanelHiddenBagFrames = 0;
            log("面板已收起；重新打开以核验任务状态，不重置本轮开始标记。");
        }
    } else if (visual.kind === "unknown") {
        panelMayBeOpen = false;
        log("当前没有匹配的安全状态；继续只读监测，不点击。");
    }
    __startupCheckpoint("before_poll_sleep", String(CONFIG.pollMs));
    sleep(CONFIG.pollMs);
}

__startupCheckpoint("live_loop_exit", stopRequested ? "stop_requested" : "loop_ended");
log("脚本结束。");
});





