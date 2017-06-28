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

var date = require('date-and-time');
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
// var event_api_url = 'http://localhost:8080/api/events'
var event_api_url = "http://eventapi-smartcity.azurewebsites.net/api/events"
var request = require('request')

var GoogleAPI = require('./google.api')
var googleAPI = new GoogleAPI()
app.use(bodyParser.urlencoded({ extended: false })); //Parses urlencoded bodies
app.use(bodyParser.json()) //SendJSON response
app.use(logger('dev'))
app.use(cors());

app.use(express.static('public'))



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
        let soundZones = getZones(req.params.location_id, 3, 1);
        // console.log(soundZones);
        let processedZones = 0;
        let noiseLevelMean = 0;
        let sum = 0;
        let count = 0;
        soundZones.forEach((zone) => {
            redisConnector.getCoordinate(zone, (err, coordinate) => {
                if (err)
                    return res.status(400).json({ "status": "error while getting location" });

                if (coordinate.records.length > 0) {
                    for (var i = 0; i < coordinate.records.length; i++) {
                        let record = coordinate.records[i];
                        sum += record.dbFrame.average
                        count++;
                    };
                }
                processedZones += 1;

                if (processedZones == soundZones.length) {
                    noiseLevelMean = sum / count;
                    console.log(sum, count);
                    res.status(200).json({ "noiseLevelMean": noiseLevelMean });
                }
            })
        }, this);

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
            console.log(fetched_events, 'of', user.toDoList.length);
            if (user.toDoList.length == 0)
                return res.status(200).json({ events: [] })
            user.toDoList.forEach(function (event_id) {
                console.log(fetched_events,' ', event_id);
                var options = {
                    method: 'GET',
                    url: `${event_api_url}/${event_id}`,
                    headers:
                    { 'content-type': 'application/json' }
                }
                request(options, (err, response, body) => {
                    fetched_events++;
                    if (!body)
                        return;
                    // console.log("HERE++++++++++++++++++++++++++++++++++", body)
                    body = JSON.parse(body);
                    console.log(typeof(body), body);
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

            user.addEvent(req.body, false, (err, status) => {
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

router.route('/schedule_place')
    .post((req, res) => {
        console.log(req.user.user_id);
        console.log(req.body);
        let eventDate = new Date(req.body.goingDetails.date);
        let sTime = date.parse(req.body.goingDetails.startTime, 'hh:mm');
        let eTime = date.parse(req.body.goingDetails.endTime, 'hh:mm');
        sTime = new Date(eventDate.getTime() + sTime.getTime());
        eTime = new Date(eventDate.getTime() + eTime.getTime());

        console.log('---------------------------------------', sTime.toLocaleDateString(), sTime.toLocaleTimeString());
        console.log('---------------------------------------', eTime.toLocaleDateString(), eTime.toLocaleTimeString());
        redisConnector.getUser(req.user.user_id, (err, user) => {
            if (err) {
                return res.send(400).json({ 'message': "error while retriving user from redis" });
            }
            console.log(user);
            let placeDetails = req.body.placeDetails;
            let event =
                {
                    "_id": `${user.user_id}_${user.ownEventsCount}`,
                    "id": `${user.ownEventsCount}`,
                    "name": `${placeDetails.name}`,
                    "type": "googlePlace",
                    "coverPicture": `${placeDetails.img}`,
                    "description": `${req.body.goingDetails.description}`,
                    "startTime": `${sTime}`,
                    "endTime": `${eTime}`,
                    "category": "place",
                    "user": `${user.user_id}`,
                    "types": `${placeDetails.types}`,
                    "stats": {
                        "attending": 0,
                        "declined": 0,
                        "maybe": 0,
                        "noreply": 0
                    },
                    "venue": {
                        "id": "ChIJEWzx0Z_8ykARAZLb9mWwBq4",
                        "name": `${placeDetails.name}`,
                        "about": null,
                        "coverPicture": `${placeDetails.img}`,
                        "profilePicture": `${placeDetails.img}`,
                        "location": {
                            "city": "Iasi",
                            "country": "Romania",
                            "latitude": `${placeDetails.geometry.location.lat}`,
                            "longitude": `${placeDetails.geometry.location.lng}`,
                            "street": `${placeDetails.formatted_address}`,
                            "zip": "",
                            "mgrs": `${placeDetails.geometry.location.mgrs}`
                        }
                    }
                }

            let body = {
                event: event
            }

            console.log(body);
            var options = {
                method: 'POST',
                url: `${event_api_url}/${event._id}`,
                body: body,
                json: true,
                headers:
                { 'content-type': 'application/json' }
            }
            request(options, (err, response, body) => {
                if (!body)
                    return;
                // console.log(response);
                // body = JSON.parse(body);
                if (err) {
                    return;
                }

                user.addEvent(event, true, (err, status) => {
                    if (err) {
                        return res.status(400).json("Error while adding event in toDoList")
                    }
                    redisConnector.saveObject(user.user_id, user, () => {
                        return res.status(200).json(status);
                    })

                });
                // return res.status(200).json({ events: eventsNearby });
            }
            )
        })
    });

router.route('/events')
    .get((req, res) => {
        let params = req.query;
        console.log(params)
        if (!params["nP"])
            params["nP"] = 3
        console.log(queryString.stringify(params));
        console.log(">>>>>>>>>>>>>>>>>", params['mgrs']);
        let zones = getZones(params.mgrs, params.radius, 10);
        console.log(zones.length, zones);
        var processedZones = 0;
        var eventsNearby = [];
        zones.forEach(function (zone) {

            params.mgrs = zone;

            var options = {
                method: 'GET',
                url: `${event_api_url}?${queryString.stringify(params)}`,
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
                    eventsNearby.sort((a, b) => { return (a.startTime > b.startTime) ? 1 : ((b.startTime > a.startTime) ? -1 : 0); });
                    console.log("Sending events to user", eventsNearby.length);
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
            qs: req.query
            ,
            headers: { 'content-type': 'application/json' }
        };

        request(options, (error, response, body) => {
            if (error) {
                return res.status(400).json("Error while fetching weather data")
            }
            console.log("body is", typeof (body));
            body = JSON.parse(body);
            return res.status(200).json(body);
        });
    })
router.route('/city/:mgrs_value')
    .get((req, res) => {
        console.log(req.params.mgrs_value);
        let geoPoint = mgrs.toPoint(req.params.mgrs_value);
        googleAPI.getCityByGeocoordinate(geoPoint[1], geoPoint[0], (err, result) => {

            res.status(200).json({
                status: 'ok',
                result: result
            })
        });
    });

router.route('/city/:mgrs_value/places')
    .get((req, res) => {
        // console.log(req.params.mgrs_value)
        let geoPoint = mgrs.toPoint(req.params.mgrs_value);
        googleAPI.getNearbyPlaces(geoPoint[1], geoPoint[0], 3000, (err, placesObj) => {
            res.status(200).json({
                status: 'ok',
                places: placesObj
            })
        })
    })

router.route('/place/:place_id')
    .get((req, res) => {
        googleAPI.getPlaceDetais(req.params.place_id, (err, placeDetails) => {
            if (err)
                return res.status(400).json({ 'status': 'error while retriving place details' })
            // placeDetails = JSON.parse(placeDetails);
            console.log(placeDetails.result.geometry.location);
            placeDetails.result.geometry.location['mgrs'] = mgrs.forward([placeDetails.result.geometry.location.lng, placeDetails.result.geometry.location.lat], 3);
            // console.log(placeDetails, typeof(placeDetails));
            return res.status(200).json(placeDetails);
        })
    })






// setting authentication check
app.use('/location', jwtCheck);
app.use('/noise', jwtCheck);
app.use('/schedule', jwtCheck);
app.use('/schedule_place', jwtCheck);
app.use('/city', jwtCheck);
app.use('/', router);



/**
 * 
 */
getZones = function (mgrs_pos, nearbyPlaceRadius, distaceFactor) {
    let min = -Math.trunc(nearbyPlaceRadius / 2)
    let max = - min;
    let result = [];
    mgrs_accuracy = 3
    for (var i = min; i <= max; i++)
        for (var j = min; j < max - i; j++) {

            let temp_mgrs = [mgrs_pos.slice(0, 5), parseInt(mgrs_pos.slice(5, 5 + mgrs_accuracy)), parseInt(mgrs_pos.slice(5 + mgrs_accuracy, 5 + 2 * mgrs_accuracy))];
            temp_mgrs[1] = temp_mgrs[1] + i * distaceFactor;
            temp_mgrs[2] = temp_mgrs[2] + j * distaceFactor;

            result.push(temp_mgrs.join(''));
            if (j == -i) {
                break;
            }

            temp_mgrs = [mgrs_pos.slice(0, 5), parseInt(mgrs_pos.slice(5, 5 + mgrs_accuracy)), parseInt(mgrs_pos.slice(5 + mgrs_accuracy, 5 + 2 * mgrs_accuracy))];
            temp_mgrs[1] = temp_mgrs[1] - j * distaceFactor;
            temp_mgrs[2] = temp_mgrs[2] - i * distaceFactor;
            result.push(temp_mgrs.join(''));
        }
    return result
}

clearNoiseMeasures = (next) => {
    redisConnector.removeExpiredRecords((status) => {
        next(status);
    })


}

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

