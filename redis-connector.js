var redis = require("redis");
var UserDevice = require('./user-device')
var Coordinate = require("./coordinate");
// redis_cli = redis.createClient();
class RedisConnector {
    constructor(ip, port) {
        this.redis_cli = redis.createClient();
        this.redis_cli.on('connect', () => {
            console.log('connected to local redis');
        });
    }
    getCoordinate(mgrs, next) {
        let obj;
        console.log('getiing coordinate')
        this.redis_cli.get(mgrs, (err, result) => {
            if (err)
                return next(err)
            // return next(null, result);

            if (!result) {
                //there was no such coordinate then i have to create it
                obj = new Coordinate(null, null, mgrs);

            } else {
                // console.log("already known location")
                let coordinate_data = JSON.parse(result);
                obj = new Coordinate(coordinate_data.longitude, coordinate_data.latitude, mgrs);
                obj.devices = coordinate_data.devices
                obj.records = coordinate_data.records
            }
            // console.log("=>",obj);
            return next(null, obj)
        });
    }
    saveObject(objectID, object, next) {
        this.redis_cli.set(objectID, JSON.stringify(object));
        next(null);
    }

    getUserDevice(deviceID, next) {
        this.redis_cli.get(deviceID, (err, result) => {
            if (err)
                return next(err)
            return next(null, result);
        })
    }


}

module.exports = RedisConnector;