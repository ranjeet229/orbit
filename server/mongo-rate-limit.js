// A shared fixed-window store: rate limits survive scaling and cold starts.
export class MongoRateLimitStore {
  constructor(model, prefix) { this.model = model; this.prefix = prefix; this.localKeys = false; }
  init(options) { this.windowMs = options.windowMs; }
  bucket(key) { return `${this.prefix}:${Math.floor(Date.now()/this.windowMs)}:${key}`; }
  async increment(key) {
    const expires = new Date((Math.floor(Date.now()/this.windowMs)+1)*this.windowMs);
    const query = {_id:this.bucket(key)};
    const update = {$inc:{hits:1},$setOnInsert:{expires}};
    let doc;
    try { doc = await this.model.findOneAndUpdate(query,update,{upsert:true,new:true}); }
    catch(error) { if(error.code !== 11000) throw error; doc = await this.model.findOneAndUpdate(query,{$inc:{hits:1}},{new:true}); }
    return {totalHits:doc.hits,resetTime:doc.expires};
  }
  async decrement(key) { await this.model.updateOne({_id:this.bucket(key),hits:{$gt:0}},{$inc:{hits:-1}}); }
  async resetKey(key) { await this.model.deleteOne({_id:this.bucket(key)}); }
}
