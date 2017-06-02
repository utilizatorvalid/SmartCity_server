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
    var mgrs_id = mgrs.forward([coords.longitude, coords.latitude], 4);

    //get coordinate for current location;
    redisConnector.getCoordinate(mgrs_id, (err, result) => {
        if (err)
            res.status(400).json({ "status": `error while getting coordinate${mgrs_id}` });
        let coordinate;
        let userDevice
        if (!result) {
            //there was no such coordinate then i have to create it
            coordinate = new Coordinate(coords.longitude, coords.latitude)
        } else {
            // console.log("already known location")
            let coordinate_data = JSON.parse(result);
            coordinate = new Coordinate(coordinate_data.longitude, coordinate_data.latitude);
            coordinate.devices =  coordinate_data.devices

        }
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
                        let coordinate1_data = JSON.parse(result);
                        var coordinate1 = new Coordinate(coordinate1_data.longitude, coordinate1_data.latitude);
                        coordinate1.devices =  coordinate1_data.devices
                        coordinate1.removeDevice(userDevice)
                        redisConnector.saveObject(coordinate1.mgrs, coordinate1,()=>{});
                    })
                        userDevice.updateLocation(mgrs_id);
                    //daca se schimba locata trebuie sa il sterg  din lista deivice-urilor de la locatia la care era
                }
            }
            // console.log("HERE")
            coordinate.addDevice(userDevice);
            redisConnector.saveObject(userDevice.user_id, userDevice, ()=>{});
            redisConnector.saveObject(coordinate.mgrs, coordinate,()=>{});
        })
        

    })
    // redis_cli.get(coord.mgrs, (err, reply) => {
    //     // console.log(JSON.parse(reply));
    //     if (reply != null) {
    //         //complete new coordinate have
    //         console.log("locatie deja cunoscuta doar adaug device-ul si salvez");
    //         coord = JSON.parse(reply);
    //     }
    //     coord.addDevice(userDevice);
    //     redis_cli.set(coord.mgrs, JSON.stringify(coord));
    //     redis_cli.set(userDevice.user_id, JSON.stringify(userDevice));
    //     var response = "location received";
    //     res.json(response);
    // });
});
app.post("/noise", (req, res) => {
    var response = 'noise level received';
    var mgrs_coord = mgrs.forward([req.body.coords.longitude, req.body.coords.latitude], 4)
    console.log(mgrs_coord)
    console.log(req.body.recordResult);
    res.json(response);
})

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

