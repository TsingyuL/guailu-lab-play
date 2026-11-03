const { DrivingAudio, createAudioBackend } = require('./audio');
function createPlatform() {
  const native = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
  const canvas = native ? wx.createCanvas() : document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const api = { native, canvas, ctx, handlers: {}, width: 1440, height: 850, rotated: false, safe: { left: 0, right: 0, top: 0, bottom: 0 }, menuInset: 0, audio: {} };
  api.fontUI = '"PingFang SC", "Microsoft YaHei", sans-serif';
  api.fontDisplay = api.fontUI; api.font = api.fontUI;
  api.createImage = () => native ? wx.createImage() : new Image();
  api.makeCanvas = (width, height) => {
    const offscreen = native ? wx.createCanvas() : document.createElement('canvas');
    offscreen.width = width; offscreen.height = height;
    return offscreen;
  };
  if (native && wx.loadFont) {
    try { const family = wx.loadFont('assets/fonts/WildroadRound.ttf'); if (family) api.fontDisplay = '"' + family + '", sans-serif'; } catch (_) {}
  } else if (!native && typeof FontFace !== 'undefined') {
    const font = new FontFace('WildroadRound', 'url(assets/fonts/WildroadRound.ttf)');
    font.load().then(loaded => { document.fonts.add(loaded); api.fontDisplay = '"WildroadRound", "PingFang SC", sans-serif'; }).catch(() => {});
  }
  const info = () => native ? (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) : { windowWidth: window.innerWidth, windowHeight: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 };
  api.resize = () => {
    const system = info();
    api.physicalWidth = system.windowWidth; api.physicalHeight = system.windowHeight;
    // A single upright layout on phones, tablets and desktop previews.
    api.rotated = false; api.portrait = true;
    const h=system.windowHeight,w=Math.min(system.windowWidth,h*(h>system.windowWidth?720/1120:9/16));
    api.offsetX=(system.windowWidth-w)/2;api.offsetY=0;
    api.width=720;api.height=720*h/w;
    // Bound fill-rate on large Retina previews; normal phones retain 2x pixels.
    api.scale = w / api.width; api.dpr = Math.min(system.pixelRatio || 1, 2,Math.sqrt(1800000/(system.windowWidth*system.windowHeight)));
    canvas.width = Math.round(system.windowWidth * api.dpr);
    canvas.height = Math.round(system.windowHeight * api.dpr);
    if (!native) { canvas.style.width = system.windowWidth + 'px'; canvas.style.height = system.windowHeight + 'px'; }
    const s = system.safeArea;
    api.safe = { left: 0, right: 0, top: 0, bottom: 0 };
    if (s) api.safe = { left: Math.max(0, s.left-api.offsetX) / api.scale, right: Math.max(0, api.offsetX+w-s.right) / api.scale, top: Math.max(0, s.top) / api.scale, bottom: Math.max(0, system.windowHeight - s.bottom) / api.scale };
    // 微信右上角胶囊不属于 safeArea；单独预留其占用的横向空间。
    api.menuInset = native ? 150 : 0;
    api.menuBottom = native ? api.safe.top+70 : 0;
    if (native && wx.getMenuButtonBoundingClientRect) {
      try { const menu = wx.getMenuButtonBoundingClientRect(); if (menu) {api.menuInset = Math.max(0,(api.offsetX+w-menu.left)/api.scale+12);if(Number.isFinite(menu.bottom))api.menuBottom=Math.max(0,(menu.bottom-api.offsetY)/api.scale);} } catch (_) {}
    }
    if (api.handlers.resize) api.handlers.resize();
  };
  api.beginFrame = () => {
    if(api.frameClip)ctx.restore();
    ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
    ctx.fillStyle='#263e37';ctx.fillRect(0,0,api.physicalWidth,api.physicalHeight);
    ctx.translate(api.offsetX,api.offsetY);
    ctx.scale(api.scale, api.scale);
    ctx.save();ctx.beginPath();ctx.rect(0,0,api.width,api.height);ctx.clip();api.frameClip=true;
  };
  api.toPoint = (x, y) => ({x:(x-api.offsetX)/api.scale,y:(y-api.offsetY)/api.scale});
  api.on = (event, callback) => { api.handlers[event] = callback; };
  const send = (type, id, x, y) => { if (api.handlers[type]) api.handlers[type](id, api.toPoint(x, y)); };
  const saveKey='wildroad-save-v1',backupKey='wildroad-save-backup-v1';
  const readSave = key => {
    try {
      const value=native?wx.getStorageSync(key):localStorage.getItem(key);
      const data=typeof value==='string'?JSON.parse(value):value;
      return data&&typeof data==='object'&&!Array.isArray(data)&&
        (Number.isFinite(data.coins)||Array.isArray(data.firstClears)||Array.isArray(data.routeBests))?data:null;
    } catch (_) { return null; }
  };
  api.load = () => readSave(saveKey)||readSave(backupKey);
  api.save = data => {
    try {
      if (native) wx.setStorageSync(saveKey, data);
      else localStorage.setItem(saveKey, JSON.stringify(data));
      // Keep a second copy for recovery from an interrupted or corrupted write.
      try {
        if (native) wx.setStorageSync(backupKey, data);
        else localStorage.setItem(backupKey, JSON.stringify(data));
      } catch (_) { /* The primary save has already succeeded. */ }
      return true;
    } catch (_) { return false; }
  };
  api.loadTelemetry = () => {
    try { return native ? (wx.getStorageSync('wildroad-events-v1')||[]) : JSON.parse(localStorage.getItem('wildroad-events-v1')||'[]'); } catch (_) { return []; }
  };
  api.saveTelemetry = events => {
    try { if(native)wx.setStorageSync('wildroad-events-v1',events);else localStorage.setItem('wildroad-events-v1',JSON.stringify(events));return true; } catch (_) { return false; }
  };
  const mixer=new DrivingAudio(createAudioBackend(native));
  api.unlockAudio = () => mixer.unlock();
  api.sound = (name,enabled=true) => mixer.effect(name,enabled);
  api.drivingSound = (state,dt) => {try{mixer.update(state,dt);}catch(_){/* 音频失败不影响驾驶。 */}};
  api.stopDrivingSound = () => {try{mixer.stop();}catch(_){}};
  api.silence = () => {try{mixer.silence();}catch(_){}};
  api.vibrate = () => { if (native && wx.vibrateShort) wx.vibrateShort({ type: 'light' }); };
  api.raf = callback => requestAnimationFrame(callback);
  if (native) {
    let lastTouchAt = 0;
    const changedTouches = (e, callback) => {
      const touches = e && (e.changedTouches || e.touches);
      if (!touches) return;
      for (let i = 0; i < touches.length; i++) if (touches[i]) callback(touches[i], i);
    };
    const touch = (type, e) => {
      lastTouchAt = Date.now();
      changedTouches(e, (t, i) => send(type, t.identifier ?? i, t.clientX ?? t.x, t.clientY ?? t.y));
    };
    wx.onTouchStart(e => touch('down', e));
    wx.onTouchMove(e => touch('move', e));
    wx.onTouchEnd(e => touch('up', e));
    wx.onTouchCancel(e => touch('cancel', e));
    // PC 微信和部分开发者工具版本会发送鼠标事件而不是模拟触摸事件。
    // 真机触摸后短时间内忽略兼容鼠标事件，避免一次点击被处理两遍。
    const mouse = (type, e) => {
      if (Date.now() - lastTouchAt < 800) return;
      send(type, 'mouse', e.clientX ?? e.x, e.clientY ?? e.y);
    };
    if (typeof wx.onMouseDown === 'function') wx.onMouseDown(e => mouse('down', e));
    if (typeof wx.onMouseMove === 'function') wx.onMouseMove(e => mouse('move', e));
    if (typeof wx.onMouseUp === 'function') wx.onMouseUp(e => mouse('up', e));
    wx.onHide(() => { api.silence(); if (api.handlers.hide) api.handlers.hide(); });
    wx.onShow(() => { api.resize(); if(api.handlers.show)api.handlers.show(); });
    // A phone call can interrupt audio without hiding the canvas. Pause the run
    // and require the player's next gesture, just like returning from background.
    if(wx.onAudioInterruptionBegin)wx.onAudioInterruptionBegin(()=>{api.silence();if(api.handlers.hide)api.handlers.hide();});
    if(wx.onAudioInterruptionEnd)wx.onAudioInterruptionEnd(()=>{if(api.handlers.show)api.handlers.show();});
    if (wx.onWindowResize) wx.onWindowResize(api.resize);
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: true });
  } else {
    canvas.addEventListener('pointerdown', e => { canvas.focus(); canvas.setPointerCapture?.(e.pointerId); send('down', e.pointerId, e.clientX, e.clientY); });
    canvas.addEventListener('pointermove', e => { send('move', e.pointerId, e.clientX, e.clientY); });
    canvas.addEventListener('pointerup', e => send('up', e.pointerId, e.clientX, e.clientY));
    canvas.addEventListener('pointercancel', e => send('cancel', e.pointerId, e.clientX, e.clientY));
    if(!window.PointerEvent){
      for(const [event,type] of [['touchstart','down'],['touchmove','move'],['touchend','up'],['touchcancel','cancel']])canvas.addEventListener(event,e=>{
        e.preventDefault();for(const t of Array.from(e.changedTouches||[]))send(type,t.identifier,t.clientX,t.clientY);
      },{passive:false});
    }
    canvas.addEventListener('wheel',e=>{
      const unit=e.deltaMode===1?16:e.deltaMode===2?api.physicalHeight:1;
      if(api.handlers.wheel?.(e.deltaY*unit/api.scale,api.toPoint(e.clientX,e.clientY)))e.preventDefault();
    },{passive:false});
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) e.preventDefault();
      if (!e.repeat && api.handlers.keydown) api.handlers.keydown(e.key.toLowerCase());
    });
    window.addEventListener('keyup', e => { if (api.handlers.keyup) api.handlers.keyup(e.key.toLowerCase()); });
    window.addEventListener('blur', () => { api.silence();if (api.handlers.hide) api.handlers.hide(); });
    window.addEventListener('focus', () => { if(api.handlers.show)api.handlers.show(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { api.silence(); if (api.handlers.hide) api.handlers.hide(); } else if(api.handlers.show)api.handlers.show(); });
    window.addEventListener('resize', api.resize);
  }
  api.resize();
  return api;
}
module.exports = { createPlatform };
