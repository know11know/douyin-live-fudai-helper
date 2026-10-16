// Pure validation is shared by AutoX and offline Node tests.
function validate(entry) {
    if (!entry || !/^custom_[0-9]+_[0-9]+$/.test(entry.id)) throw new Error("图片编号无效");
    if (entry.width !== 1440 || entry.height !== 2560 || entry.dpi !== 640) throw new Error("模板必须来自 1440×2560 / DPI 640");
    var r = entry.region;
    if (!Array.isArray(r) || r.length !== 4 || !r.every(function(n) {return typeof n === 'number' && isFinite(n) && Math.floor(n) === n;})) throw new Error("区域应为四个整数：x,y,宽,高");
    // Entry imports are restricted to the top live-room area; not task/payment controls.
    if (r[0] < 0 || r[1] < 120 || r[2] < 16 || r[3] < 16 || r[0]+r[2] > 1440 || r[1]+r[3] > 800) throw new Error("入口搜索区域必须位于顶部 y=120~800，且不能超出屏幕");
    if (!Number.isInteger(entry.imageWidth) || !Number.isInteger(entry.imageHeight) || entry.imageWidth < 16 || entry.imageHeight < 16 || entry.imageWidth > r[2] || entry.imageHeight > r[3]) throw new Error("图片必须至少 16×16，且不大于搜索区域");
    if (entry.imageWidth > 320 || entry.imageHeight > 320) throw new Error("请裁剪为不大于 320×320 的入口图案");
    if (typeof entry.label !== 'string' || entry.label.length > 80) throw new Error("名称最长 80 字");
    return entry;
}
function load(fileApi, root) {
    var p = root + '/custom/entries.json';
    if (!fileApi.exists(p)) return [];
    var list = JSON.parse(fileApi.read(p));
    if (!Array.isArray(list) || list.length > 12) throw new Error("模板清单异常，最多导入 12 张");
    var seen = {};
    return list.map(function(e) {
        validate(e);
        if (seen[e.id]) throw new Error("模板编号重复");
        seen[e.id] = true;
        if (!fileApi.exists(root + '/custom/entries/' + e.id + '.png')) throw new Error("模板文件缺失：" + e.label);
        return e;
    });
}
module.exports = {validate:validate, load:load};
