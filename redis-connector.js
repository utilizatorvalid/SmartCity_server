var redis = require("redis");
var User = require('./user')
var Device = require('./device')
var Coordinate = require("./coordinate");

// redis_cli = redis.createClient();
class RedisConnector {
    constructor(ip, port) {
        this.redis_cli = redis.createClient();
        this.redis_cli.on('connect', () => {
            console.log('connected to local redis');
        });
    }
    getCoordinate(mgrs_value, next) {
        let obj;
        console.log('getiing coordinate')
        if (!mgrs_value)
            return next(new Error("invalid mgrs"))
        this.redis_cli.get(mgrs_value, (err, result) => {
            if (err)
                return next(err)
            // return next(null, result);

            if (!result) {
                //there was no such coordinate then i have to create it
                obj = new Coordinate(null, null, mgrs_value);


            } else {
                // console.log("already known location")
                let coordinate_data = JSON.parse(result);
                obj = new Coordinate(coordinate_data.longitude, coordinate_data.latitude, mgrs_value);
                obj.devices = coordinate_data.devices
                obj.records = coordinate_data.records
            }
            // console.log("=>",obj);
            return next(null, obj)
        });
    }
    saveObject(objectID, object, next) {
        // console.log("SAVING", objectID, object);
        this.redis_cli.set(objectID, JSON.stringify(object));
        next(null);
    }

    getUserDevice(user_id, mgrs_value, next) {
        let device_id = `device|${user_id}`;
        let obj;
        this.redis_cli.get(device_id, (err, result) => {
            if (err)
                return next(err)
            if (!result) {
                obj = new Device(device_id, mgrs_value)
            } else {
                let deviceData = JSON.parse(result)
                obj = new Device(deviceData.device_id, deviceData.currentLocation)
                obj.lastLocation = deviceData.lastLocation;
            }
            return next(null, obj);
        })
    }
    getUser(user_id, next) {
        let obj;
        this.redis_cli.get(user_id, (err, result) => {
            if (err)
                return next(err)

            if (!result) {
                obj = new User(user_id);
            } else {
                let userData = JSON.parse(result)
                obj = new User(user_id);
                obj.toDoList = userData.toDoList;
                obj.history = userData.history;
                obj.ownEventsCount = userData.ownEventsCount;
            }
            return next(null, obj);
        })
    }

    //functia scrisa de tine eu am un connector catre redis 
    getKeys(pattern, next) {
        this.redis_cli.keys(pattern, (err, keys) => {
            if (err)
                return next(err)
            return next(null, keys);
        })
    }

    removeExpiredRecords(next) {
        this.getKeys("[1-9][1-9][A-Z][A-Z][A-Z]*", (err, keys) => {
            if (err)
                return;
            console.log(keys);
            var index = 0;
            keys.forEach(function (mgrs) {
                this.getCoordinate(mgrs, (err, coordinate) => {
                    if (err) {
                        // continue;
                        console.log(err);
                    }
                    console.log("clean->", mgrs)

                    coordinate.clearNoiseMeasures();
                    this.saveObject(mgrs, coordinate, () => { });
                    index++;
                    if (index === keys.length)
                        next("all clear");
                })
            }, this);
        })

    }

}

module.exports = RedisConnector;

