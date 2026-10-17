"ui";
var jumpControl = storages.create("fudai-jump-control");
ui.layout('<vertical padding="24" bg="#F5F7FA"><text text="自动跳转开关" textSize="26sp"/><text id="state" textSize="18sp" marginTop="20"/><button id="pause" text="暂停自动跳转" marginTop="20"/><button id="resume" text="恢复自动跳转"/><text text="立即生效，保留直播间链接。只控制返回直播间，自动参与仍继续。两台模拟器分别设置。" textSize="16sp" marginTop="20"/><button id="backLive" text="返回抖音"/></vertical>');
function refresh(){ui.state.setText(jumpControl.get("paused",false) ? "当前：自动跳转已暂停" : "当前：自动跳转已开启");}
ui.pause.on("click",function(){jumpControl.put("paused",true);refresh();toast("已暂停自动跳转");});
ui.resume.on("click",function(){jumpControl.put("paused",false);refresh();toast("已恢复自动跳转");});
ui.backLive.on("click",function(){app.launchPackage("com.ss.android.ugc.aweme");ui.finish();});
refresh();
