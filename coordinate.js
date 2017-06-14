const mgrs_convertor = require('mgrs');

class Coordinate {
    constructor(longitude, latitude, mgrs_value) {
        var point
        if (mgrs_value)
            point = mgrs_convertor.toPoint(mgrs_value);

        if (longitude == null && latitude == null) {
            longitude = point[0];
            latitude = point[1];
        }

        this.longitude = longitude;
        this.latitude = latitude;
        this.mgrs_value = mgrs_convertor.forward([longitude, latitude], 3);
        this.devices = [];
        this.records = [];
    }

    addDevice(device) {
        //console.log(`location->${this.mgrs}: add device:${device.user_id}`);
        var index = -1;
        for (var i = 0; i < this.devices.length; i++) {
            // console.log(`!${this.devices[i].user_id}\n${device.user_id}!=>${this.devices[i].user_id == device.user_id}`);
            // console.log(this.devices[i].user_id);
            if (this.devices[i].device_id == device.device_id)
                index = i;
        }
        // console.log("endList")
        if (index == -1)
            this.devices.push(device);
        // console.log("index",index);
    }
    removeDevice(device) {
        // console.log(`location->${this.mgrs}: remove device ${device.user_id}`);
        // console.log("remove from:")
        //console.log(this.devices);
        var index = -1;
        for (var i = 0; i < this.devices.length; i++) {
            // console.log(`|${this.devices[i].user_id}|\n|${device.user_id}|=>${this.devices[i].user_id == device.user_id}`);
            if (this.devices[i].device_id == device.device_id)
                index = i;
        }
        // console.log("endList")
        if (index != -1)
            this.devices.splice(index, 1);
        // console.log("index",index);

    }
    addRecord(record) {
        this.records.push({
            "timestamp": new Date(),
            "dbFrame": record
        })
    }
    clearNoiseMeasures() {
        var index = 0;
        this.records.forEach(function (dbFrame) {
            if (this._hoursPast(dbFrame.timestamp) > 1) {
                this.records.splice(index, 1);
            }
            index++;
        }, this);
    }

    _hoursPast(startTime) {
        var start = new Date(startTime);
        var now = new Date(Date.now());

        var hours = Math.trunc(Math.abs(start.getTime() - now.getTime()) / 36e5);
        return hours;
    }


}

module.exports = Coordinate;