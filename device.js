var mgrs = require('mgrs');

class Device{

    constructor(device_id, currentLocation){
        this.device_id = device_id;
        this.lastLocation = null;
        this.currentLocation = currentLocation;
    }
     updateLocation(newLocation){
        
        console.log("user-device change Location", `${this.currentLocation}->${newLocation}`);
        this.lastLocation = this.currentLocation;
        this.currentLocation = newLocation;
    }
}

module.exports = Device