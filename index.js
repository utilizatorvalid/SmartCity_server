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
var CrawlerManager = require('./crawler-manager');
var event_api_url = "http://smartcityeventapi.azurewebsites.net/api/events"
var request = require('request')
app.use(bodyParser.urlencoded({ extended: false })); //Parses urlencoded bodies
app.use(bodyParser.json()) //SendJSON response
app.use(logger('dev'))
app.use(cors());



var redisConnector = new RedisConnector();
var crawlerManager = new CrawlerManager();





var router = express.Router();

router.use((req, res, next) => {

    next()
})


router.route('/location')
    .post((req, res) => {
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
            redisConnector.getUserDevice(req.user.user_id, (err, result) => {
                if (err)
                    res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });
                if (!result) {
                    userDevice = new UserDevice(req.user.user_id, mgrs_id)
                } else {
                    let userDevice_data = JSON.parse(result);
                    userDevice = new UserDevice(userDevice_data.user_id, userDevice_data.currentLocation);
                    userDevice.toDoList = userDevice.toDoList
                    if (mgrs_id != userDevice.currentLocation) {
                        // console.log(`${typeof mgrs_id} ${typeof userDevice.currentLocation}`,mgrs_id != userDevice.currentLocation);
                        // console.log(`\t user with id${userDevice.user_id}==change location==${userDevice.currentLocation}->${mgrs_id}`);
                        redisConnector.getCoordinate(userDevice.currentLocation, (err, result) => {
                            let old_coordinate = result;
                            old_coordinate.removeDevice(userDevice)
                            redisConnector.saveObject(old_coordinate.mgrs, old_coordinate, () => { });
                        })
                        userDevice.updateLocation(mgrs_id);

                        //request for uptade on events....

                        crawlerManager.update(coords.longitude, coords.latitude);
                        //daca se schimba locata trebuie sa il sterg  din lista deivice-urilor de la locatia la care era
                    }
                }
                // console.log("HERE")
                coordinate.addDevice(userDevice);
                redisConnector.saveObject(userDevice.user_id, userDevice, () => { });
                redisConnector.saveObject(coordinate.mgrs, coordinate, () => { });
                res.status(200).send({
                    "status": "location_updated",
                    "currentLocation": userDevice.currentLocation,
                    "lastLocation": userDevice.lastLocation
                });
            })


        })
    })


router.route('/noise')
    .post((req, res) => {
        var response = 'noise level received';
        // var mgrs_coord = mgrs.forward([req.body.coords.longitude, req.body.coords.latitude], 4)
        // console.log(req.body)
        // console.log(req.body.recordResult);

        redisConnector.getCoordinate(req.body.mgrs, (err, coordinate) => {
            if (err)
                res.status(400).json({ "status": "error while getting coordinate to update noise level" })
            coordinate.addRecord(req.body.recordResult);
            redisConnector.saveObject(req.body.mgrs, coordinate, () => { });
        });
        res.json(response);
    })
router.route('/clean')
    .get((req, res) => {
        clearNoiseMeasures((response) => {
            res.status(200).json(response);
        });
    })

router.route('/keys')
    .get((req, res) => {
        redisConnector.getKeys('*', (err, keys) => {
            if (err) {
                // console.log("am erroare cand eu cheile din redis")
            }
            console.log("cheile care corespund cu petternul sunt", keys);
            res.send(keys)
        })
    })

router.route('/location:location_id')
    .get((req, res) => {
        redisConnector.getCoordinate(req.params.location_id, (err, coordinate) => {
            if (err)
                res.status(400).json({ "status": "error while getting location" });
            res.json(coordinate)
        })
    })

router.route('/schedule')
    .get((req, res) => {
        //geting all users event to do 
        redisConnector.getUserDevice(req.user.user_id, (err, result) => {
            if (err)
                res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });
            if (!result) {
                console.log("HERE");
                userDevice = new UserDevice(req.user.user_id, mgrs_id)
            } else {
                let userDevice_data = JSON.parse(result);
                userDevice = new UserDevice(userDevice_data.user_id, userDevice_data.currentLocation);
                userDevice.toDoList = userDevice_data.toDoList
            }
            var fetched_events = 0;
            var user_events = [];
            userDevice.toDoList.forEach(function (event_id) {
                var options = {
                    method: 'GET',
                    url: `http://smartcityeventapi.azurewebsites.net/api/events/${event_id}`,
                    headers:
                    { 'content-type': 'application/json' }
                }
                request(options, (err, response, body)=>{
                    fetched_events ++;
                    body = JSON.parse(body);
                    console.log(typeof(body));
                    if(err)
                    {
                        //todo
                        return;
                    }
                    user_events.push(body.events[0]);
                    if (fetched_events == userDevice.toDoList.length)
                    {
                        return res.status(200).json({events:user_events});
                    }

                })
                
            }, this);

        });

        console.log('Schedule for user:', req.user.nickname);
    })
router.route('/schedule/:event_id')
    .post((req, res) => {
        console.log("add event", req.params.event_id, ' in users', req.user.user_id, ' toDoList');
        console.log(req.body);
        redisConnector.getUserDevice(req.user.user_id, (err, result) => {
            if (err)
                res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });
            if (!result) {
                console.log("HERE");
                userDevice = new UserDevice(req.user.user_id, mgrs_id)
            } else {
                let userDevice_data = JSON.parse(result);
                userDevice = new UserDevice(userDevice_data.user_id, userDevice_data.currentLocation);
                userDevice.toDoList = userDevice_data.toDoList
            }
            console.log(userDevice);
            userDevice.addEvent(req.body, (err, status) => {
                if (err) {
                    return res.status(400).json("Error while adding event in toDoList")
                }
                redisConnector.saveObject(userDevice.user_id, userDevice, () => {
                    return res.status(200).json(status);
                })

            });
        });
    })



app.use('/location', jwtCheck);
app.use('/noise', jwtCheck);
app.use('/schedule', jwtCheck);
app.use('/', router);



clearNoiseMeasures = (next) => {
    redisConnector.getKeys("[1-9][1-9][A-Z][A-Z][A-Z]*", (err, keys) => {
        if (err)
            return;
        console.log(keys);
        var index = 0;
        keys.forEach(function (mgrs) {
            redisConnector.getCoordinate(mgrs, (err, coordinate) => {
                if (err) {
                    // continue;
                    console.log(err);
                }
                console.log("clean->", mgrs)

                coordinate.clearNoiseMeasures();
                redisConnector.saveObject(mgrs, coordinate, () => { });
                index++;
                if (index === keys.length)
                    next("all clear");
            })
        }, this);
    })


}

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

