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
        this.toDoList = [];
    }
    updateLocation(newLocation){
        
        console.log("user-device change Location", `${this.currentLocation}->${newLocation}`);
        this.lastLocation = this.currentLocation;
        this.currentLocation = newLocation;
    }
    addEvent(event, next){
        console.log(`${event._id} in ${this.toDoList}`)
        var index = -1;
        for (var i = 0; i < this.toDoList.length; i++) {
            // console.log(`!${this.devices[i].user_id}\n${device.user_id}!=>${this.devices[i].user_id == device.user_id}`);
            // console.log(this.devices[i].user_id);
            if (this.toDoList[i] == event._id)
                index = i;
        }
        // console.log("endList")
        if (index != -1)
            return next(null,{ message:"event is already in your to_do_list"})
        {
            this.toDoList.push(event._id);
            return next(null, {message:"added"})
        }    
        // console.log("index",index);

        
    }


}

module.exports = UserDevice;