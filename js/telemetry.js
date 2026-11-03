class Telemetry {
  constructor(platform,version='1.0.7-road-monsters') {
    this.platform=platform;this.version=version;
    this.sessionId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
    const stored=platform.loadTelemetry?.();
    this.events=Array.isArray(stored)?stored.slice(-1000):[];
  }
  track(name,properties={}) {
    const event={id:this.sessionId+'-'+this.events.length,name,at:Date.now(),sessionId:this.sessionId,version:this.version,properties};
    this.events.push(event);if(this.events.length>1000)this.events=this.events.slice(-1000);
    try{this.platform.saveTelemetry?.(this.events);}catch(_){/* 体验记录失败不能影响驾驶。 */}
    return event;
  }
  export(){return JSON.parse(JSON.stringify(this.events));}
}
module.exports={Telemetry};
