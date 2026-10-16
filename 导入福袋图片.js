threads.start(function () {
    var root = String(engines.myEngine().getSource()).replace(/^file:\/\//, '').replace(/\/[^\/]*$/, '');
    var support = require(root + '/lib/entries.js');
    var list;
    try { list = support.load(files, root); }
    catch(e) { dialogs.alert('模板清单无法读取', String(e)); return; }
    var action = dialogs.select('福袋入口图片', '导入图片', '删除已导入图片');
    if (action < 0) return;
    function save() { files.ensureDir(root+'/custom/entries/'); files.write(root+'/custom/entries.json', JSON.stringify(list,null,2)); }
    if (action === 1) {
        if (!list.length) { dialogs.alert('暂无自定义图片', '内置图片不受影响。'); return; }
        var n = dialogs.select('选择要删除的图片', list.map(function(e){return e.label;}));
        if (n >= 0 && dialogs.confirm('删除图片', list[n].label)) {
            var removed = list.splice(n,1)[0]; save(); files.remove(root+'/custom/entries/'+removed.id+'.png');
            dialogs.alert('已删除', '重新启动发布版后生效。');
        }
        return;
    }
    if (list.length >= 12) { dialogs.alert('已达上限', '最多 12 张，请先删除不用的图片。'); return; }
    var img = null, crop = null, destination = null;
    try {
        if (!dialogs.confirm('来源确认', '图片必须来自模拟器内部 1440×2560、DPI 640 的截图。支持完整原始截图或已裁剪的入口图案；电脑桌面截图、缩放图片不可用。\n\n导入期间请停止本发布版；不要和其他自动点击脚本同时运行。继续？')) return;
        // A local browser avoids dependency on vendor-specific activity-result APIs.
        var dir = '/sdcard/Download';
        var selected = null;
        while (selected === null) {
            var names = files.listDir(dir, function(n){return files.isDir(files.join(dir,n)) || /\.(png|jpe?g)$/i.test(n);}) || [];
            names.sort();
            var c = dialogs.select('选择图片：'+dir, ['手动输入完整路径','上一级'].concat(names));
            if (c < 0) return;
            if (c === 0) { selected = dialogs.rawInput('模拟器内的图片路径', '/sdcard/Download/entry.png'); if (!selected) return; }
            else if (c === 1) { dir = dir.replace(/\/[^\/]+\/?$/, '') || '/'; }
            else { var p = files.join(dir,names[c-2]); if (files.isDir(p)) dir=p; else selected=p; }
        }
        img = images.read(selected);
        if (!img) throw new Error('图片无法读取，请检查存储权限及路径');
        var w = img.getWidth(), h = img.getHeight();
        var input = dialogs.rawInput('裁剪范围 x,y,宽,高', w === 1440 && h === 2560 ? '40,430,140,120' : '0,0,'+w+','+h);
        if (input === null) return;
        var box = String(input).split(',').map(function(v){return Number(v.trim());});
        if (box.length!==4 || !box.every(function(v){return Number.isInteger(v);}) || box[0]<0 || box[1]<0 || box[2]<16 || box[3]<16 || box[0]+box[2]>w || box[1]+box[3]>h) throw new Error('裁剪范围无效');
        if ((w > 320 || h > 320) && (w !== 1440 || h !== 2560)) throw new Error('完整截图必须是 1440×2560；裁剪图最大 320×320');
        var regionText = dialogs.rawInput('搜索范围 x,y,宽,高（原始屏幕坐标）', '20,400,320,300');
        if (regionText === null) return;
        var label = dialogs.rawInput('图片名称', '自定义福袋入口');
        if (label === null) return;
        var entry = {id:'custom_'+Date.now()+'_'+Math.floor(Math.random()*1000000),label:String(label),width:1440,height:2560,dpi:640,imageWidth:box[2],imageHeight:box[3],region:String(regionText).split(',').map(function(v){return Number(v.trim());})};
        support.validate(entry);
        if (w===1440 && h===2560 && (box[0]<entry.region[0] || box[1]<entry.region[1] || box[0]+box[2]>entry.region[0]+entry.region[2] || box[1]+box[3]>entry.region[1]+entry.region[3])) throw new Error('裁剪入口必须位于搜索范围内');
        if (!dialogs.confirm('保存入口图片', entry.label+'\n裁剪：'+box.join(',')+'\n搜索：'+entry.region.join(',')+'\n请确认裁剪只包含稳定图案，避开倒计时和变化文字。')) return;
        files.ensureDir(root+'/custom/entries/');
        crop=images.clip(img,box[0],box[1],box[2],box[3]);
        destination=root+'/custom/entries/'+entry.id+'.png';
        images.save(crop,destination,'png',100);
        if (!files.exists(destination)) throw new Error('图片保存失败');
        list.push(entry); save(); destination=null;
        dialogs.alert('导入完成', '重新启动发布版后生效。请先运行“只识别测试”，确认入口识别正确。导入不会适配新的任务面板皮肤。');
    } catch(e) {
        if (destination && files.exists(destination)) files.remove(destination);
        dialogs.alert('导入失败', String(e));
    } finally {
        if (crop) crop.recycle();
        if (img) img.recycle();
    }
});
