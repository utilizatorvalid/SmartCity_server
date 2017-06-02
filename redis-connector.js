var redis = require("redis");
        // redis_cli = redis.createClient();
class RedisConnector{
    constructor(ip, port){
        this.redis_cli = redis.createClient();
        this.redis_cli.on('connect', () => {
            console.log('connected to local redis');
        });
    }
    getCoordinate(mgrs, next){
        this.redis_cli.get(mgrs,(err,result)=>{
            if(err)
                return next(err)
            return next(null, result);
        })
    }
    saveObject(objectID,object ,next){
        this.redis_cli.set(objectID, JSON.stringify(object));
        next(null);
    }

    getUserDevice(deviceID, next){
        this.redis_cli.get(deviceID, (err, result)=>{
            if(err)
                return next(err)
            return next(null, result);
        })
    }

   
}

module.exports = RedisConnector;