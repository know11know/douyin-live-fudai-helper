threads.start(function () {
    var root = String(engines.myEngine().getSource()).replace(/^file:\/\//, '').replace(/\/[^\/]*$/, '');
    var choice = dialogs.select('抖音直播间福袋挂机助手', '启动自动参与', '只识别测试（单次，不点击）', '导入 / 管理福袋入口图片', '分辨率与使用说明');
    if (choice === 0 || choice === 1) {
        engines.execScriptFile(root + '/runner.js', {arguments:{mode:choice === 0 ? 'live' : 'dry-run'}});
    } else if (choice === 2) {
        engines.execScriptFile(root + '/导入福袋图片.js');
    } else if (choice === 3) {
        dialogs.alert('适配要求', '内部画面 1440×2560、DPI 640、竖屏。仅处理你打开的单账号抖音直播间。\n\n导入图片只扩展顶部福袋入口，不扩展任务面板和开奖结果皮肤。先运行只识别测试，查看 AutoX 日志，再启动自动参与。\n\n保持抖音前台和屏幕常亮；按音量加或在 AutoX 管理页停止。详细步骤见随包 README.md。');
    }
});
