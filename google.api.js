var queryString = require('query-string')
var request = require('request');
var fii = {
    "address_components": [
        {
            "long_name": "16",
            "short_name": "16",
            "types": ["street_number"]
        },
        {
            "long_name": "Strada General Henri Mathias Berthelot",
            "short_name": "Strada General Henri Mathias Berthelot",
            "types": ["route"]
        },
        {
            "long_name": "Iași",
            "short_name": "Iași",
            "types": ["locality", "political"]
        },
        {
            "long_name": "Municipiul Iași",
            "short_name": "Municipiul Iași",
            "types": ["administrative_area_level_2", "political"]
        },
        {
            "long_name": "Județul Iași",
            "short_name": "IS",
            "types": ["administrative_area_level_1", "political"]
        },
        {
            "long_name": "Romania",
            "short_name": "RO",
            "types": ["country", "political"]
        },
        {
            "long_name": "700259",
            "short_name": "700259",
            "types": ["postal_code"]
        }
    ],
    "formatted_address": "Strada General Henri Mathias Berthelot 16, Iași 700259, Romania",
    "geometry": {
        "location": {
            "lat": 47.1739724,
            "lng": 27.5749111
        },
        "location_type": "ROOFTOP",
        "viewport": {
            "northeast": {
                "lat": 47.17532138029149,
                "lng": 27.5762600802915
            },
            "southwest": {
                "lat": 47.17262341970849,
                "lng": 27.57356211970849
            }
        }
    },
    "place_id": "ChIJvUboJ2L7ykARLE5QZGhLPhk",
    "types": ["establishment", "point_of_interest"]
}

class GoogleAPI {
    // API_KEY
    // geocodeEndpoint;
    constructor() {
        this.PLACES_API_KEY = 'AIzaSyASKxzBYOd4WcgvwAnebFN9vnlSYmWSGU0'
        this.GEOCODE_API_KEY = 'AIzaSyCh3JARHmzX9MdAO3-mnXN_3H2N5E0OznA'
        this.geocodeEndpoint = 'https://maps.googleapis.com/maps/api/geocode/json'
        this.placesEndpoint = 'https://maps.googleapis.com/maps/api/place/'
        this.placeTypes = [
            'city_hall',
            'church',
            'university',
            'library',
            'book_store',
            'museum',
            'park',
            'campground',
            'cafe',
            'bar',
            'restaurant',
            'gym',
            'bowling_alley',
            'night_club',
        ]
        // this.placeTypes = [
        //     'university',
        //     'library',
        // ]
    }

    getCityByGeocoordinate(lat, long, next) {
        var params = {
            latlng: `${lat},${long}`,
            key: this.GEOCODE_API_KEY
        }

        // for (var i = 0, len = result.address_components.length; i < len; i++) {
        //      var ac = result.address_components[i];
        //     if (ac.types.indexOf("administrative_area_level_1") >= 0) state = ac.short_name;
        //  }
        //  if (state != '') {
        //      console.log("Hello to you out there in " + city + ", " + state + "!");
        //  }

        // console.log(this.geocodeEndpoint+'?'+queryString.stringify(params))
        this.getCityName(this.geocodeEndpoint + '?' + queryString.stringify(params), (err, cityName) => {

            if (err)
                return next(err);
            this.getCityId(cityName, (err, cityId) => {
                if (err)
                    return next(err);
                this.getPlaceDetais(cityId, (err, details) => {
                    // console.log(cityId);
                    return next(null, details);

                })
            });
        })
    }
    getCityName(url, next) {
        console.log('getting city name');
        let options = {
            method: 'GET',
            url: url,
            headers: { 'content-type': 'application/json' }
        }

        request(options, (err, response, body) => {
            if (err)
                return next(err)
            body = JSON.parse(body);
            // console.log(body)
            if (!body.status == "OK") {
                console.log('error on getting information about city by latlon')
                return next(err);
            }
            let result = body.results[0]
            let cityName = '';
            for (var i = 0, len = result.address_components.length; i < len; i++) {
                var ac = result.address_components[i];
                if (ac.types.indexOf("administrative_area_level_1") >= 0) cityName = ac.long_name;
            }

            console.log("Hello to you out there in " + cityName + "!");
            next(null, cityName);
        })



    }
    getCityId(cityName, next) {
        let params = {
            address: cityName,
            key: this.GEOCODE_API_KEY
        }
        console.log('getting city ID...', params);
        let url = `${this.geocodeEndpoint}?${queryString.stringify(params)}`
        var options = {
            method: 'GET',
            url: url,
            headers: { 'content-type': 'application/json' }
        }
        request(options, (err, response, body) => {
            if (err) {
                return next(err)
            }
            // console.log(response);
            body = JSON.parse(body);
            // console.log(body);
            let result = body.results[0];
            if (!result)
                return next('NO_CITY');
            return next(null, result.place_id);


        })
    }
    getPlaceDetais(placeID, next) {
        let params = {
            placeid: placeID,
            key: this.PLACES_API_KEY
        }
        let url = `${this.placesEndpoint}details/json?${queryString.stringify(params)}`
        var options = {
            method: 'GET',
            url: url,
            headers: { 'content-type': 'application/json' }
        }
        request(options, (err, response, body) => {
            if (err) {
                return next(err)
            }
            // console.log(response);
            body = JSON.parse(body);
            // console.log(body);
            return next(null, body);


        })

    }

    getNearbyPlaces(lat, lon, radius, next) {
        let params = {
            location: `${lat},${lon}`,
            radius: radius,
            type: this.placeTypes[0],
            key: this.PLACES_API_KEY
        }
        let result = {}
        let searchedTypes = 0;
        this.placeTypes.forEach(type => {
            params.type = type;
            this.getNearby(params, (err, searchResponse) => {
                if (err) {
                    console.log("search nearby error for ", type);
                }
                searchedTypes++;
                result[type] = searchResponse;
                if (type == 'university')
                    console.log(result[type].results.push(fii));
                // result[type].push('');
                if (searchedTypes == this.placeTypes.length) {
                    return next(null, result)
                }
            })

        })



    }
    getNearby(params, next) {
        let url = `${this.placesEndpoint}nearbysearch/json?${queryString.stringify(params)}`
        console.log('>>>>>>>>>>>>>>>>>>>>', url)
        var options = {
            method: 'GET',
            url: url,
            headers: { 'content-type': 'application/json' }
        }
        request(options, (err, response, body) => {
            if (err) {
                return next(err)
            }
            // console.log(response);
            body = JSON.parse(body);
            // console.log(body);
            return next(null, body);
        })
    }
}

module.exports = GoogleAPI;