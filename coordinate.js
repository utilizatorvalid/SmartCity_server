var mgrs = require('mgrs')

class Coordinate {
    constructor(longitude, latitude) {
        this.longitude = longitude;
        this.latitude = latitude;
        this.mgrs = mgrs.forward([longitude, latitude], 4);
        this.devices = [];
    }

    addDevice(device) {
        //console.log(`location->${this.mgrs}: add device:${device.user_id}`);
        var index = -1;
        for(var i=0; i<this.devices.length; i++)
        {   
            // console.log(`!${this.devices[i].user_id}\n${device.user_id}!=>${this.devices[i].user_id == device.user_id}`);
            // console.log(this.devices[i].user_id);
            if (this.devices[i].user_id == device.user_id)
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
        for(var i=0; i<this.devices.length; i++)
        {   
            // console.log(`|${this.devices[i].user_id}|\n|${device.user_id}|=>${this.devices[i].user_id == device.user_id}`);
            if (this.devices[i].user_id == device.user_id)
                index = i;
        }
        // console.log("endList")
        if (index != -1)
            this.devices.splice(index, 1);
        // console.log("index",index);
        
}


}

module.exports = Coordinate;