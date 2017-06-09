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
        console.log(`add ${event._id} in ${this.toDoList}`)
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
        this.toDoList.push(event._id);
        return next(null, {message:"added"})

        
    }

    removeEvent(event_id, next){
         console.log(`remove ${event_id} from ${this.toDoList}`)
         var index = -1;

         for(var i=0; i<this.toDoList.length; i++){
                if(this.toDoList[i] == event_id)
                    index = i;
         }
         if(index == -1)
            return next(null, {message:"event is already removed from to do list"});

        console.log(`romoving event ${event_id} at position ${index}`)
        this.toDoList.splice(index, 1);
        return next(null, {message:"event removed from to do list"})
            
         
    }


}

module.exports = UserDevice;