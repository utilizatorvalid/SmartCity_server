var mgrs = require('mgrs')

class Coordinate{
    constructor(longitude, latitude){
        this.longitude = longitude;
        this.latitude = latitude;
        this.mgrs =  mgrs.forward([longitude,latitude],4);
    }


}

module.exports = Coordinate;