const WINTER = "winter";
const SUMMER = "summer";
const WATER = "water";
const WIND = "wind";
const VISIBILITY = "visibility";

module.exports = {
    "soccer": [SUMMER],
    "basketball": [SUMMER],
    "volleyball": [SUMMER],
    "rollerblading": [SUMMER],
    "bicycle": [SUMMER],
    "cycling": [SUMMER],
    "biking": [SUMMER], 
    "hiking": [SUMMER],
    "jogging": [SUMMER], 
    "lacrosse": [SUMMER],
    "power walking": [SUMMER],
    "running": [SUMMER], 
    "trotting": [SUMMER],
    "walking": [SUMMER],
    
    "tennis": [SUMMER, VISIBILITY],
    "archery": [SUMMER, VISIBILITY],
    "cricket": [SUMMER, VISIBILITY],
    "golf": [SUMMER, VISIBILITY],
    "baseball": [SUMMER, VISIBILITY],
    
    "kayaking": [SUMMER, WATER],
    "boating": [SUMMER, WATER],
    "swimming": [SUMMER, WATER],
    "tubing": [SUMMER, WATER],
    "water skiing": [SUMMER, WATER],
    "surfing": [SUMMER, WATER],
    "surf": [SUMMER, WATER],
    
    "sailing": [SUMMER, WATER, WIND, VISIBILITY],
    "windsurfing": [SUMMER, WATER, WIND, VISIBILITY],
    "kitesurfing": [SUMMER, WATER, WIND, VISIBILITY],
    
    "skiing": [WINTER],
    "snowboarding": [WINTER],
    "ice skating": [WINTER], 
    "snow": [WINTER], 
    "snowmobile": [WINTER],
    "snowman": [WINTER]
}