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



app.use(bodyParser.urlencoded({ extended: false })); //Parses urlencoded bodies
app.use(bodyParser.json()) //SendJSON response
app.use(logger('dev'))
app.use(cors());


var redis = require("redis"),
    redis_cli = redis.createClient();

redis_cli.on('connect', () => {
    console.log('connected to local redis');
});




app.use('/location', jwtCheck);
app.use('/noise', jwtCheck);
app.post('/location', (req, res) => {
    //console.log(req.user);
    let coords = req.body.position.coords;

    var coord = new Coordinate(coords.longitude, coords.latitude)
    // console.log(mgrs_coord)
    // console.log(mgrs.toPoint(mgrs_coord))
    redis_cli.get(coord.mgrs,(err, reply)=>{
       // console.log(JSON.parse(reply));
        if(reply == null){
            //console.log(coord);
            redis_cli.set(coord.mgrs,JSON.stringify(coord));
        }
    });

    var response = "location received";
    res.json(response);
});
app.post("/noise", (req, res) => {
    var response = 'noise level received';
    console.log(req.body.coords);
    var mgrs_coord = mgrs.forward([coords.longitude, coords.latitude], 4)
    console.log(mgrs_coord)
    console.log(req.body.recordResult);
    res.json(response);
})

server.listen(port, () => {
    console.log(`backend listening on port ${port}`);
});

