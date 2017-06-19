var mgrs = require('mgrs')

class User{
    
    /**
     * 
     * @param {*} user This is user id 
     * @param {*} currentLocation location in format mgrs
     */
    constructor(user_id){
        this.user_id = user_id;
        this.device_id = `decive|${user_id}`
        this.ownEventsCount = 0
        this.toDoList = [];
        this.history  = [];
    }
   
    addEvent(event, ownEvent, next){
        console.log(`add ${event._id} in ${this.toDoList}`)
        if(ownEvent){
            this.ownEventsCount++;
        }
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

    removeEvent(event_id, rejected, next){
         console.log(`remove ${event_id} from ${this.toDoList}`)
         var index = -1;

         for(var i=0; i<this.toDoList.length; i++){
                if(this.toDoList[i] == event_id)
                    index = i;
         }
         if(index == -1)
            return next(null, {message:"event is already removed from to do list"});

        console.log(`romoving event ${event_id} at position ${index}`)
        if(!rejected)
            this.history.push(event_id);
            
        this.toDoList.splice(index, 1);
        return next(null, {message:"event removed from to do list"})
           
         
    }



}

module.exports = User;