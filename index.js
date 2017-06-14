var http = require("http");
var express = require("express");
var app = express();
var logger = require("morgan")
var queryString = require('query-string')
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
var User = require('./user');
var Device = require('./device');
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
    decodeURI(req);
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
            coordinate = result;

            redisConnector.getUserDevice(req.user.user_id, mgrs_id, (err, device) => {
                if (err)
                    return res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });

                if (mgrs_id != device.currentLocation) {
                    redisConnector.getCoordinate(device.currentLocation, (err, result) => {
                        let old_coordinate = result;
                        old_coordinate.removeDevice(device)
                        redisConnector.saveObject(old_coordinate.mgrs_value, old_coordinate, () => { });
                    })
                    device.updateLocation(mgrs_id);

                    crawlerManager.update(coords.longitude, coords.latitude);
                    //daca se schimba locata trebuie sa il sterg  din lista deivice-urilor de la locatia la care era
                }

                // console.log("HERE")
                coordinate.addDevice(device);
                redisConnector.saveObject(device.device_id, device, () => { });
                redisConnector.saveObject(coordinate.mgrs_value, coordinate, () => { });
                res.status(200).send({
                    "status": "location_updated",
                    "currentLocation": device.currentLocation,
                    "lastLocation": device.lastLocation
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
                return res.status(400).json({ "status": "error while getting coordinate to update noise level" })
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

router.route('/location/:location_id')
    .get((req, res) => {
        redisConnector.getCoordinate(req.params.location_id, (err, coordinate) => {
            if (err)
                return res.status(400).json({ "status": "error while getting location" });
            let noiseLevelMean = 0;
            let sum = 0;
            if (coordinate.records.length > 0) {
                for (var i = 0; i < coordinate.records.length; i++) {
                    let record = coordinate.records[i];
                    sum += record.dbFrame.average
                };
                noiseLevelMean = sum / coordinate.records.length
            }
            res.status(200).json({ "noiseLevelMean": noiseLevelMean });

        })
    })

router.route('/schedule')
    .get((req, res) => {
        //geting all users event to do 
        console.log('Schedule for user:', req.user.nickname);
        redisConnector.getUser(req.user.user_id, (err, user) => {
            if (err)
                return res.status(400).json({ "status": `error while getting user${req.user.user_id}` });
            var fetched_events = 0;
            var user_events = [];
            if (user.toDoList.length == 0)
                return res.status(200).json({ events: [] })
            user.toDoList.forEach(function (event_id) {
                var options = {
                    method: 'GET',
                    url: `http://smartcityeventapi.azurewebsites.net/api/events/${event_id}`,
                    headers:
                    { 'content-type': 'application/json' }
                }
                request(options, (err, response, body) => {
                    fetched_events++;
                    if (!body)
                        return;
                    // console.log("HERE++++++++++++++++++++++++++++++++++", body)
                    body = JSON.parse(body);
                    // console.log(typeof(body));
                    if (err) {
                        //todo
                        return;
                    }
                    user_events.push(body.events[0]);
                    if (fetched_events == user.toDoList.length) {
                        user_events.sort((a, b) => { return (a.startTime > b.startTime) ? 1 : ((b.startTime > a.startTime) ? -1 : 0); });
                        return res.status(200).json({ events: user_events });
                    }

                })

            }, this);

        });

    })
router.route('/schedule/:event_id')
    .post((req, res) => {
        console.log("add event", req.params.event_id, ' in users', req.user.user_id, ' toDoList');
        // console.log(req.body);
        redisConnector.getUser(req.user.user_id, (err, user) => {
            if (err)
                return res.status(400).json({ "status": `error while getting User${req.user.user_id}` });

            user.addEvent(req.body, (err, status) => {
                if (err) {
                    return res.status(400).json("Error while adding event in toDoList")
                }
                redisConnector.saveObject(user.user_id, user, () => {
                    return res.status(200).json(status);
                })

            });
        });
    })
    .delete((req, res) => {
        // console.log("remove event", req.params.event_id, ' in users', req.user.user_id, ' toDoList' );
        redisConnector.getUser(req.user.user_id, (err, user) => {
            if (err)
                return res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });
            user.removeEvent(req.params.event_id, true, (err, status) => {
                if (err)
                    return res.status(400).json({ "message": "error while removing event from to do list" });
                redisConnector.saveObject(user.user_id, user, () => {
                    return res.status(200).json({ "status": "REMOVED" });
                })
            })

        })
    })

router.route('/events')
    .get((req, res) => {
        let params = req.query;
        params["nP"] = 3
        console.log(params);
        console.log(queryString.stringify(params));
        console.log(">>>>>>>>>>>>>>>>>", params['mgrs']);
        let zones = getZones(params.mgrs);
        console.log(zones);
        var processedZones = 0;
        var eventsNearby = [];
        zones.forEach(function (zone) {

            params.mgrs = zone;

            var options = {
                method: 'GET',
                url: `${event_api_url}${queryString.stringify(params)}`,
                headers:
                { 'content-type': 'application/json' }
            }
            request(options, (err, response, body) => {
                processedZones++;
                if (!body)
                    return;
                // return res.status(400).json({"status":"error getting events form api"});
                body = JSON.parse(body);
                if (err) {
                    return;
                    // return res.status(400).json({"status":"error getting events form api"});
                }

                eventsNearby = eventsNearby.concat(body.events);
                if (processedZones == zones.length) {
                    console.log("HEREEEEEEEEEEEEEE", eventsNearby.length)
                    eventsNearby.sort((a, b) => { return (a.startTime > b.startTime) ? 1 : ((b.startTime > a.startTime) ? -1 : 0); });
                    return res.status(200).json({ events: eventsNearby });
                }
            })
        }, this);
    })

router.route('/user')
    .put((req, res) => {

    })
    .post((req, res) => {

    })
    .get((req, res) => {

        // console.log("USER ID::::",decodeURI(req.));
        redisConnector.getUser(req.params.user_id, (err, user) => {
            if (err) {
                return res.status(400).json({ "status": `error while getting User${req.user.user_id}` });
            }

            console.log(user);
            return res.status(200).json({
                "status": "OK",
                "user": user
            });
        })
    })

router.route('/user/:user_id')
    .post((req, res) => {
        //create user
        redisConnector.getUser(req, params.user_id, (err, user) => {
            if (err)
                return res.status(400).json({ "status": `error while saving User${req.user.user_id}` });
            redisConnector.saveObject(user.user_id, user, () => {
                return res.status(200).json({
                    "status": "OK",
                    "user": user
                });
            })
        })

    })
    .get((req, res) => {
        redisConnector.getUser(req.params.user_id, (err, user) => {
            if (err)
                return res.status(400).json({ "status": `error while getting user${req.user.user_id}` });

            redisConnector.getUserDevice(user.user_id, null, (err, device) => {
                if (err)
                    return res.status(400).json({ "status": `error while getting userDevice${req.user.user_id}` });

                return res.status(200).json({
                    "user": user,
                    "device": device
                });
            })

        })
    })

router.route('/weather')
    .get((req, res) => {
        console.log(req.query);
        req.query['APPID'] = "c3ec8d1775bd91da4f6d7d7d6ae1a195";

        var request = require("request");

        var options = {
            method: 'GET',
            url: 'http://api.openweathermap.org/data/2.5/forecast/daily',
            qs:req.query
            ,
            headers:{ 'content-type': 'application/json' }
        };

        request(options, (error, response, body)=>{
             if (error) {
                    return res.status(400).json("Error while fetching weather data")
                }
            console.log(body);
            return res.status(200).json(body);
        });
    })




app.use('/location', jwtCheck);
app.use('/noise', jwtCheck);
app.use('/schedule', jwtCheck);
app.use('/', router);



getZones = (mgrs_pos) => {
    let mgrs1 = mgrs_pos.split('');
    mgrs1[4 + 3 - 1] = parseInt(mgrs1[4 + 3 - 1]) - 1;
    mgrs1[4 + 6 - 1] = parseInt(mgrs1[4 + 6 - 1]) - 1;

    let mgrs2 = mgrs_pos.split('');
    mgrs2[4 + 3 - 1] = parseInt(mgrs2[4 + 3 - 1]) - 1;
    mgrs2[4 + 6 - 1] = parseInt(mgrs2[4 + 6 - 1]) + 0;

    let mgrs3 = mgrs_pos.split('');
    mgrs3[4 + 3 - 1] = parseInt(mgrs3[4 + 3 - 1]) - 1;
    mgrs3[4 + 6 - 1] = parseInt(mgrs3[4 + 6 - 1]) + 1;

    let mgrs4 = mgrs_pos.split('');
    mgrs4[4 + 3 - 1] = parseInt(mgrs4[4 + 3 - 1]) + 1;
    mgrs4[4 + 6 - 1] = parseInt(mgrs4[4 + 6 - 1]) - 1;

    let mgrs5 = mgrs_pos.split('');
    mgrs5[4 + 3 - 1] = parseInt(mgrs5[4 + 3 - 1]) + 1;
    mgrs5[4 + 6 - 1] = parseInt(mgrs5[4 + 6 - 1]) + 0;

    let mgrs6 = mgrs_pos.split('');
    mgrs6[4 + 3 - 1] = parseInt(mgrs6[4 + 3 - 1]) + 1;
    mgrs6[4 + 6 - 1] = parseInt(mgrs6[4 + 6 - 1]) + 1;

    let mgrs7 = mgrs_pos.split('');
    mgrs7[4 + 3 - 1] = parseInt(mgrs7[4 + 3 - 1]) + 0;
    mgrs7[4 + 6 - 1] = parseInt(mgrs7[4 + 6 - 1]) - 1;

    let mgrs8 = mgrs_pos.split('');
    mgrs8[4 + 3 - 1] = parseInt(mgrs8[4 + 3 - 1]) + 0;
    mgrs8[4 + 6 - 1] = parseInt(mgrs8[4 + 6 - 1]) + 1;
    return [mgrs_pos,
        mgrs1.join(''),
        mgrs2.join(''),
        mgrs3.join(''),
        mgrs4.join(''),
        mgrs5.join(''),
        mgrs6.join(''),
        mgrs7.join(''),
        mgrs8.join('')]
}

clearNoiseMeasures = (next) => {
    redisConnector.removeExpiredRecords((status) => {
        next(status);
    })


}

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

