"ui";
var base = String(engines.myEngine().getSource()).replace(/^file:\/\//, "").replace(/\/[^\/]*$/, "");
var configPath = base + "/live-room.json";
// Opening settings pauses the worker so it cannot pull the user away from this page.
files.write(String(context.getExternalFilesDir(null).getAbsolutePath()) + "/douyin-live-helper-active-run.txt", "settings-" + Date.now());
ui.layout('<vertical padding="20" bg="#F5F7FA"><text text="福袋控制台" textSize="26sp" textColor="#172B4D" marginBottom="16"/><text text="直播间链接" textSize="18sp"/><input id="link" hint="粘贴抖音直播分享文字或链接" minLines="3" gravity="top"/><horizontal><button id="paste" text="粘贴" layout_weight="1"/><button id="save" text="保存链接" layout_weight="1"/></horizontal><text id="status" text="尚未保存链接" textSize="16sp" marginTop="12"/><button id="start" text="进入直播间并启动自动参与" marginTop="24"/><button id="jumpSettings" text="暂停／恢复自动跳转"/><button id="clear" text="清除链接，使用手动直播间"/><text text="两台模拟器分别保存。修改后点启动。运行中退出直播间，会按保存的链接返回。" textSize="14sp" marginTop="20"/></vertical>');
var saved = null, busy = false;
try { if (files.exists(configPath)) { saved = JSON.parse(files.read(configPath)); ui.link.setText(saved.link || ""); ui.status.setText("已保存直播间 " + saved.roomId); } } catch(e) {}
function resolveRoom(raw) {
    var match = String(raw).match(/https?:\/\/[^\s<>\]）)]+/);
    if (!match) throw new Error("请粘贴包含链接的抖音直播分享文字");
    var original = match[0], url = original;
    for (var i=0; i<6; i++) {
        var room = url.match(/(?:room_id=|webcast\/reflow\/|live\.douyin\.com\/)(\d{10,})/);
        if (room) return {enabled:true,link:original,roomId:room[1],updatedAt:Date.now()};
        var parsed = new java.net.URL(url), host = String(parsed.getHost()).toLowerCase();
        if (!/(^|\.)(douyin\.com|amemv\.com|iesdouyin\.com)$/.test(host)) throw new Error("请使用抖音直播分享链接");
        var c = parsed.openConnection();
        try { c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setInstanceFollowRedirects(false);
            var code=c.getResponseCode(), location=c.getHeaderField("Location");
            if (code>=300 && code<400 && location) url=String(new java.net.URL(parsed,String(location))); else throw new Error("未能获取直播间，请重新复制直播分享链接");
        } finally { c.disconnect(); }
    }
    throw new Error("链接跳转过多，请重新复制");
}
ui.paste.on("click", function(){ ui.link.setText(String(getClip() || "")); ui.status.setText("已粘贴，请点保存链接"); });
ui.save.on("click", function(){
    if(busy) return; busy=true;
    var raw=String(ui.link.text()); ui.status.setText("正在保存，请稍候…");
    threads.start(function(){try {var next=resolveRoom(raw); files.write(configPath,JSON.stringify(next)); saved=next; ui.run(function(){ui.status.setText("保存成功，直播间 " + saved.roomId);});}catch(e){ui.run(function(){ui.status.setText("保存失败："+String(e.message||e));});}finally{busy=false;}});
});
ui.clear.on("click",function(){if(busy)return; files.remove(configPath); saved=null;ui.link.setText("");ui.status.setText("已清除，先手动进入直播间再启动");});
ui.start.on("click",function(){
    if(busy){toast("请等待保存完成");return;}
    if(saved && String(ui.link.text()).indexOf(saved.link)<0){ui.status.setText("输入已变化，请先保存链接");return;}
    if(saved) app.startActivity({action:"android.intent.action.VIEW",data:"snssdk1128://live?room_id="+saved.roomId,packageName:"com.ss.android.ugc.aweme"});
    else app.launchPackage("com.ss.android.ugc.aweme");
    engines.execScriptFile(base+"/runner.js"); ui.finish();
});

ui.jumpSettings.on("click",function(){engines.execScriptFile(base+"/暂停恢复跳转.js");});
