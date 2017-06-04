var  fbCrawlerConfig =  require('./event-crawler-fb.json');
var request = require('request')
class CrawlerManager{
    constructor(){
        this.crawlers = [];
        this.crawlers.push(fbCrawlerConfig);
    }
    update(long, lat){
        this.crawlers.forEach((element)=>{
            this.notifyCrawler(element, long, lat)
        }, this);
    }

    notifyCrawler(crawler, long, lat){
        console.log("trigger :", crawler, long, lat);
        var options = {
            method:crawler.method,
            url:crawler.url,
            qs:{
                lat: lat,
                lng: long,
                distance: crawler.distance,
                accessToken:crawler.accessToken
            },
            json:true
        };

        request(options,(err, response, body)=>{
            if (err) 
                console.log("eroror on crawlerManager",err);
             console.log(body);
        });
        
    }


}


module.exports = CrawlerManager;