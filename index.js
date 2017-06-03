var http = require("http");
var express = require("express");
var app = express();
var logger = require("morgan")
var bodyParser = require('body-parser')
var cors = require("cors")
var mgrs = require('mgrs')
var server = http.createServer(app);
port = process.env.PORT || 8000;


var auth0Settings = require('./auth0.json')
var jwt = require('express-jwt');
var jwtCheck = jwt({
    secret: auth0Settings.secret,
    audience: auth0Settings.audience
})

var Coordinate = require('./coordinate');
var UserDevice = require('./user-device');
var RedisConnector = require('./redis-connector');

app.use(bodyParser.urlencoded({ extended: false })); //Parses urlencoded bodies
app.use(bodyParser.json()) //SendJSON response
app.use(logger('dev'))
app.use(cors());



var redisConnector = new RedisConnector();



app.use('/location', jwtCheck);
app.use('/noise', jwtCheck);
app.post('/location', (req, res) => {
    //console.log(req.user);
    console.log("user updateLocation", req.user.nickname);


    let coords = req.body.position.coords;
    var mgrs_id = mgrs.forward([coords.longitude, coords.latitude], 3);

    //get coordinate for current location;
    redisConnector.getCoordinate(mgrs_id, (err, result) => {
        if (err)
            res.status(400).json({ "status": `error while getting coordinate${mgrs_id}` });
        let coordinate;
        let userDevice
        //if-ul asta nu cred ca este necesar;
        ///
        if (!result) {
            console.log("there is no result in redis databasea");
            return;
        } 
        //
        coordinate = result;
        redisConnector.getUserDevice(req.user.user_id,(err,result)=>{
            if(err)
                res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });
            if(!result){
                userDevice = new UserDevice(req.user.user_id, mgrs_id)
            }else
            {
                let userDevice_data = JSON.parse(result);
                userDevice = new UserDevice(userDevice_data.user_id, userDevice_data.currentLocation);

                if(mgrs_id != userDevice.currentLocation)
                {
                    // console.log(`${typeof mgrs_id} ${typeof userDevice.currentLocation}`,mgrs_id != userDevice.currentLocation);
                    // console.log(`\t user with id${userDevice.user_id}==change location==${userDevice.currentLocation}->${mgrs_id}`);
                    redisConnector.getCoordinate(userDevice.currentLocation,(err, result)=>{
                        let old_coordinate = result;
                        old_coordinate.removeDevice(userDevice)
                        redisConnector.saveObject(old_coordinate.mgrs, old_coordinate,()=>{});
                    })
                    userDevice.updateLocation(mgrs_id);
                    //daca se schimba locata trebuie sa il sterg  din lista deivice-urilor de la locatia la care era
                }
            }
            // console.log("HERE")
            coordinate.addDevice(userDevice);
            redisConnector.saveObject(userDevice.user_id, userDevice, ()=>{});
            redisConnector.saveObject(coordinate.mgrs, coordinate,()=>{});
            res.status(200).send({"status"          : "location_updated",
                                  "currentLocation" : userDevice.currentLocation,
                                  "lastLocation"    : userDevice.lastLocation  
                            });
        })
        

    })
});
app.post("/noise", (req, res) => {
    var response = 'noise level received';
    // var mgrs_coord = mgrs.forward([req.body.coords.longitude, req.body.coords.latitude], 4)
    // console.log(req.body)
    // console.log(req.body.recordResult);

    redisConnector.getCoordinate(req.body.mgrs,(err, coordinate)=>{
        if(err)
            res.status(400).json({"status":"error while getting coordinate to update noise level"})
        coordinate.addRecord(req.body.recordResult);
        redisConnector.saveObject(req.body.mgrs, coordinate,()=>{});
    });
    res.json(response);
})

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

