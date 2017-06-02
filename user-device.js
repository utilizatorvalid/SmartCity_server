var mgrs = require('mgrs')

class UserDevice{
    
    /**
     * 
     * @param {*} user user object 
     * @param {*} currentLocation location in format mgrs
     */
    constructor(user_id, currentLocation){
        this.user_id = user_id;
        this.lastLocation = null;
        this.currentLocation = currentLocation;
    }
    updateLocation(newLocation){
        
        console.log("user-device change Location", `${this.currentLocation}->${newLocation}`);
        this.lastLocation = this.currentLocation;
        this.currentLocation = newLocation;
    }


}

module.exports = UserDevice;