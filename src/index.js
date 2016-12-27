// ************************ \\
// ******* MODULES ******** \\
// ************************ \\

// API Keys
const WUNDERGROUND_APIKEY = "a173736c9f29eb5a"

// Asynchronous Package
var async = require('async');

var includes = require('array-includes');

// REST Client for Server API calls
var Client = require("node-rest-client").Client;
var client = new Client();


// **** END OF MODULES ***** //

// Set local time zone
process.env.TZ = 'America/New York'

// ALEXA STUFF

/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
        http://aws.amazon.com/apache2.0/
    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This sample shows how to create a Lambda function for handling Alexa Skill requests that:
 *
 * - Session State: Handles a multi-turn dialog model.
 * - Custom slot type: demonstrates using custom slot types to handle a finite set of known values
 * - SSML: Using SSML tags to control how Alexa renders the text-to-speech.
 *
 * Examples:
 * Dialog model:
 *  User: "Alexa, ask Wise Guy to tell me a knock knock joke."
 *  Alexa: "Knock knock"
 *  User: "Who's there?"
 *  Alexa: "<phrase>"
 *  User: "<phrase> who"
 *  Alexa: "<Punchline>"
 */

/**
 * App ID for the skill
 */
var APP_ID = undefined;//replace with 'amzn1.echo-sdk-ams.app.[your-unique-value-here]';

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');

/**
 * WiseGuySkill is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var PACTSkill = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
PACTSkill.prototype = Object.create(AlexaSkill.prototype);
PACTSkill.prototype.constructor = PACTSkill;

/**
 * Overriden to show that a subclass can override this function to initialize session state.
 */
PACTSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    
    console.log('Session request: ' + sessionStartedRequest);
    console.log('Session: ' + session);        

    // Any session init logic would go here.
};

/**
 * If the user launches without specifying an intent, route to the correct function.
 */
PACTSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("WiseGuySkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    
    console.log('Launch request: ' + launchRequest);
    console.log('Session: ' + session);
    console.log('Response: ' + response);

};

/**
 * Overriden to show that a subclass can override this function to teardown session state.
 */
PACTSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    
    console.log('Session request: ' + sessionStartedRequest);
    console.log('Session: ' + session);

    //Any session cleanup logic would go here.
};

PACTSkill.prototype.intentHandlers = {
    "BestTimeIntent": function (intent, session, response) {
        
        handleBestTimeIntent(intent, session, response);
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        var speechText = "";

        switch (session.attributes.stage) {
            case 0:
                speechText = "Knock knock jokes are a fun call and response type of joke. " +
                    "To start the joke, just ask by saying tell me a joke, or you can say exit.";
                break;
            case 1:
                speechText = "You can ask, who's there, or you can say exit.";
                break;
            case 2:
                speechText = "You can ask, who, or you can say exit.";
                break;
            default:
                speechText = "Knock knock jokes are a fun call and response type of joke. " +
                    "To start the joke, just ask by saying tell me a joke, or you can say exit.";
        }

        var speechOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        var repromptOutput = {
            speech: speechText,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };
        // For the repromptText, play the speechOutput again
        response.ask(speechOutput, repromptOutput);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

function handleBestTimeIntent(intent, session, response) {
    var speechText = "";
    var repromptText = "You can ask about the best time to perform outdoor activities.";
    
    // Read user's desired activity from slot in intent
    var activitySlot = intent.slots.Activity;
    var activity = null;
    if (activitySlot && activitySlot.value) {
        activity = String(activitySlot.value.toLowerCase());
    } else
        console.log("Activity not specified properly");
        
    // Read user's desired day from slot in intent
    var daySlot = intent.slots.SpecifiedDay;
    var day = null;
    if (daySlot && daySlot.value) {
        day = daySlot.value.toLowerCase();
    } 
    
    // Read user's desired time from slot in intent
    var timeSlot = intent.slots.SpecifiedTime;
    var time = null;
    if (timeSlot && timeSlot.value) {
        time = timeSlot.value.toLowerCase();
    }
    
    initiateActivityRequest(activity, day, time, 18.352153, -70.575001, response);
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the PACT Skill.
    var skill = new PACTSkill();
    skill.execute(event, context);
};

// End of Alexa specific stuff

// ** SERVER REQUEST HANDLING ** \\

function initiateActivityRequest(activity, date, timeOfDay, latitude, longitude, res) {    
    async.waterfall([    
        function(callback) {
            var weatherForecastURL = generateWeatherRequestURL(latitude, longitude, date);
            callback(null, weatherForecastURL);
        },
        function(weatherForecastURL, callback) {
            client.get(weatherForecastURL, function(data, response) {
                var hourlyForecast = [];
                if (response.statusCode == 403) {
                    console.log('Wunderground API Authorization Failure');
                    return
                }

                // Store all the fetched data
                for (var i = 0; i < data.hourly_forecast.length; i++) {
                    var forecast = {}
                    forecast.temperature = data.hourly_forecast[i].temp.metric;
                    forecast.feelsLike = data.hourly_forecast[i].feelslike.metric;

                    forecast.heatIndex = data.hourly_forecast[i].heatindex.metric;
                    forecast.windChill = data.hourly_forecast[i].windchill.metric;

                    forecast.windSpeed = data.hourly_forecast[i].wspd.metric;
                    forecast.humidity = data.hourly_forecast[i].humidity; // in percentage
                    forecast.uvi = data.hourly_forecast[i].uvi; // ultra violet index
                    forecast.qpf = data.hourly_forecast[i].qpf.metric; // quantitative precipitaiton forecast 
                    forecast.dewpoint = data.hourly_forecast[i].dewpoint.metric;
                    forecast.snow = data.hourly_forecast[i].snow.metric;
                    forecast.mslp = data.hourly_forecast[i].mslp.metric;
                    forecast.pop = data.hourly_forecast[i].pop;


                    forecast.time = {
                        seconds: data.hourly_forecast[i].FCTTIME.sec,
                        minutes: data.hourly_forecast[i].FCTTIME.min,
                        hours: data.hourly_forecast[i].FCTTIME.hour,
                        monthday: data.hourly_forecast[i].FCTTIME.mday,
                        year: data.hourly_forecast[i].FCTTIME.year,
                        month: data.hourly_forecast[i].FCTTIME.mon,
                        weekday: data.hourly_forecast[i].FCTTIME.weekday_name
                    } 
                    
                    var dateObject = new Date();
                    var todayDate = dateObject.getDate();           //gets the day of month
                    var dayOfWeek = dateObject.getDay();            //gets the day of week 0-6
                    var requestDate;

                    //assigning day of week to each possible requested date string
                    if(date == "tomorrow") {
                        requestDate = (dayOfWeek + 1) % 7;
                    }
                    else if(date == "today") {
                        requestDate = dayOfWeek;
                    }
                    else if(date == "Sunday") {
                        requestDate = 0;
                    }
                    else if(date == "Monday") {
                        requestDate = 1;
                    }
                    else if(date == "Tuesday") {
                        requestDate = 2;
                    }
                    else if(date == "Wednesday") {
                        requestDate = 3;
                    }
                    else if(date == "Thursday") {
                        requestDate = 4;
                    }
                    else if(date == "Friday") {
                        requestDate = 5;
                    }
                    else if(date == "Saturday") {
                        requestDate = 6;
                    }

                    //calculating the date difference of the week 
                    var dateDiff;
                    if (requestDate != null) {
                        // Find the difference b/w days
                        dateDiff = requestDate - dayOfWeek;
                        if (dateDiff < 0)
                            dateDiff += 7;
                    } else
                        console.log("requestDate is null: line ~231");

                    //calculating the day that the user wants to schedule an activity
                    var newDate = dateDiff + todayDate;
                    
                    if (forecast.time.monthday == newDate)
                        hourlyForecast.push(forecast);  
                }

                callback(null, hourlyForecast);
            }); // finished fetching data
        },
        function(hourlyForecast, callback) {
            var sortedForecast = rankAndSortForecast(hourlyForecast, activity, timeOfDay);
            console.log(sortedForecast);
            callback(null, sortedForecast);
        },
        function(sortedForecast, callback) {
            sendTopResults(sortedForecast, activity, res);
            callback(null, 'Success!');
        }
    ], function(err, result) {
        if (err)
            console.log(err);
        else
            console.log(result);
    });
}

// Send results to the Alexa via response object
function sendTopResults(rankedResults, activity, res) {
    // Send X amount of results back to the watch
    var numOfResults = 3
    
    // If less than three results, only send the results available
    if (rankedResults.length < numOfResults)
        numOfResults = rankedResults.length;
        
    var response = 'The best times for ' + activity + ' are: ';
    for (var i = 0; i < numOfResults; i++) {
        var amPm = 'AM'; // assume AM before check
        var time;
        
        if (rankedResults[i].time.hours > 11) 
            amPm = "PM";
        
        if (rankedResults[i].time.hours == 0) 
            time = 12 
        else 
            time = rankedResults[i].time.hours;
        
        var hours;
        
        if (time == 12)
            hours = String(time)
        else
            hours = String(time % 12)
        
        response += hours + ":00 " + amPm + ' on ' + rankedResults[i].time.weekday;
        
        if (i != numOfResults-1)
            response += ' or ';
    }
    
    res.tellWithCard(response, "PACT", response);
}

// ************************************ \\
// **** WUNDERGROUND Data Fetching **** \\
// ************************************ \\

function generateWeatherRequestURL(latitude, longitude, date) {
    
   var weatherForecastURL = "http://api.wunderground.com/api/<APIKEY>/hourly10day/q/<LATITUDE>,<LONGITUDE>.json";
    
    weatherForecastURL = weatherForecastURL.replace(/<LATITUDE>/, String(latitude));
    weatherForecastURL = weatherForecastURL.replace(/<LONGITUDE>/, String(longitude));
    weatherForecastURL = weatherForecastURL.replace(/<APIKEY>/, WUNDERGROUND_APIKEY);

    console.log(weatherForecastURL);
    
    return weatherForecastURL;
}

// ***************************************** \\
// **** RANKING and FORECASTING METHODS **** \\
// ***************************************** \\

// Define function to validate forecasts
function validForecast(forecast) {
    // Assume forecast is valid 
    var returnValue = true;

    // If empty, not valid
    if (forecast.length == 0) {
       returnValue = false;
    // If time is -1, it is an error message, throw it
    } else if (forecast.time == -1) {
       throw new Error(forecast);
       returnValue = false;
    }
    return returnValue;
}

function rankAndSortForecast(hourlyForecast, intent, timeOfDay) {
    // SUMMER
    var sForecast = summerForecast(hourlyForecast, intent);
    if (!validForecast(sForecast)) {
       sForecast = hourlyForecast; // fill in with all original values
    }

    // WINTER
    var wsForecast = winterForecast(sForecast, intent);
    if (!validForecast(wsForecast)) {
       wsForecast = sForecast; // fill in with all previous values
    }

    // VISIBILITY
    var vwsForecast = visibilityForecast(wsForecast, intent);
    if (!validForecast(vwsForecast)) {
       vwsForecast = wsForecast; // fill in with all previous values
    }
    
    // WIND
    var wvwsForecast = windForecast(vwsForecast, intent);

    // TIME (Doesn''t need checking, always returns all elements)
    var twvwsForecast = timeRank(wvwsForecast, timeOfDay);

    // Sort the forecasts with rankings and return
    return sortThis(twvwsForecast);
}

function sortThis(acceptableForecast) {
    
    acceptableForecast.sort(function(a,b) {
        var aRank = 0;
        var bRank = 0;
        
        var weight = 0;
        
        var aRanking = 0;
        var bRanking = 0;
        
        var visibility = false;
        var summer = false;
        var winter = false;
        var time = false;
        var wind = false;
        
        var visibilityWeight = 2;
        var summerWeight = 2;
        var winterWeight = 2;
        var timeWeight = 3;
        var windWeight = 2;
        
        if (a.visibilityRank && b.visibilityRank) {
            weight += visibilityWeight;
            visibility = true;
        }
        
        if (a.summerRank && b.summerRank) {
            weight += summerWeight;
            summer = true;
        }
        
        if (a.winterRank && b.winterRank) {
            weight += winterWeight;
            winter = true;
        }
        
        if (a.timeRank && b.timeRank) {
            weight += timeWeight;
            time = true;
        }
        
        if (a.windRank && b.windRank) {
            weight += windWeight;
            wind = true;
        }
        
        if (visibility) {
            aRanking += (a.visibilityRank/weight) * visibilityWeight;
            bRanking += (b.visibilityRank/weight) * visibilityWeight;
        }
        
        if (summer) {
            aRanking += (a.summerRank/weight) * summerWeight;
            bRanking += (b.summerRank/weight) * summerWeight;
        }
        
        if (winter) {
            aRanking += (a.winterRank/weight) * winterWeight;
            bRanking += (b.winterRank/weight) * winterWeight;
        }
        
        if (time) {
            aRanking += (a.timeRank/weight) * timeWeight;
            bRanking += (b.timeRank/weight) * timeWeight;
        }
        
        if (wind) {
            aRanking += (a.windRank/weight) * windWeight;
            bRanking += (b.windRank/weight) * windWeight;
        }
        
        return bRanking - aRanking;
    });
    
    return acceptableForecast;
}

function computeVisibility(forecast) {
// Computes the visibility for the forecast
    var milesVisibility = 0;
    
    // MSLP lower than 990 means 0.25mi visibility
    if (forecast.mslp <= 990)
        milesVisibility = 0.25
        
    // MSLP higher than 1016 hPA means 10mi visibility
    else if (forecast.mslp >= 1016)
        milesVisibility = 10;
    
    // Else, use weighted equations to calculate based on pressure, temp and dewpoint
    else {
        var visiblity1 = 0.45 * forecast.mslp - 447;
        var visibility2 = 1.13 * (forecast.temperature - forecast.dewpoint) - 1.15;
   
        // Visibility in miles
        milesVisibility = ((0.545 * visibility1) + (0.455 * visibility2));
    }
    // Return visibility in kilometers
    return 1.60934 * milesVisibility;
}

function windForecast(forecastsToUse, intent) {
    const BAD_WIND = "High winds all day. Maybe choose another activity."
    
    // For wind activities
    const IDEAL_WIND_SPEED = 25;
    const MAX_IDEAL_WIND_SPEED = 60;
    const MIN_IDEAL_WIND_SPEED = 15;
    // For non wind activities
    const MAX_WIND_SPEED = 50;
    
    var windCheck = false;
    var acceptableForecast = [];
    
    // Check for good winds for wind activites
    if (includes(intent, 'wind')) {
        for (var i = 0; i < forecastsToUse.length; i++) {
            // Checking wind speed is between acceptable ranges
            if (forecastsToUse[i].windSpeed <= MAX_IDEAL_WIND_SPEED) {
                if (forecastsToUse[i].windSpeed >= MIN_IDEAL_WIND_SPEED) {
                    windCheck = true;
                    if (!includes(acceptableForecast, forecastsToUse[i]))
                        acceptableForecast.push(forecastsToUse[i]);
                }
            }
        }
    // Check for extreme winds
    } else {
        for (var i = 0; i < forecastsToUse.length; i++) {
            if (forecastsToUse[i].windSpeed <= MAX_WIND_SPEED) {
                windCheck = true;
                if (!includes(acceptableForecast, forecastsToUse[i]))
                    acceptableForecast.push(forecastsToUse[i]);
            }
        }
    }
    if (!windCheck) {
        var result = []
        var pebbleResult = {}
        pebbleResult.time = -1
        pebbleResult.timeString = BAD_WIND;
        result.push(pebbleResult)
        acceptableForecast = result
    } else {
        acceptableForecast = windRank(acceptableForecast);
    }
    
    return acceptableForecast;
}

function windRank(acceptableForecast) {  
    var windWeight = 1;
    const MAX_WIND_SPEED = 50;

    // Calculate the weights utilized for the sort algorithm
    for (var i = 0; i < acceptableForecast.length; i++) {
        if (acceptableForecast[i].windSpeed)
            acceptableForecast[i].windRank = (Math.abs(acceptableForecast[i].windSpeed))/MAX_WIND_SPEED;
                
        if (acceptableForecast[i].windRank > 1)
            console.log("Something is very wrong.");
    }

    return acceptableForecast;
}

function visibilityForecast(forecastsToUse, intent) {
        const BAD_VISIBILITY = "Bad visibility all day. Maybe choose another activity."
        var visibilityCheck = false;
        var acceptableForecast = [];
        
        if (includes(intent, 'visibility')) {
            // for sports that need good visibility
            for (var i = 0; i < forecastsToUse.length; i++) {
                // Check within acceptable time 
                if (forecastsToUse[i].time.hours > 7 && forecastsToUse[i].time.hours <= 22) {
                    // Compute visibility in miles
                    forecastsToUse[i].visibility = computeVisibility(forecastsToUse[i]);
                    if (forecastsToUse[i].visibility > 1){
                        visibilityCheck = true;   
                    }  
                }   
            }
            if (!visibilityCheck){
                var result = []
                var pebbleResult = {}
                pebbleResult.time = -1
                pebbleResult.timeString = BAD_VISIBILITY;
                result.push(pebbleResult)
                acceptableForecast = result;
            } else {
                acceptableForecast = visibilityRank(acceptableForecast);
            }
        }
        return acceptableForecast
}

function visibilityRank(acceptableForecast) {
    var MIN_VISIBILITY_KMS = 1.5
    var visWeight = 1;
    // Calculate the weights utilized for the sort algorithm
    for (var i = 0; i < acceptableForecast.length; i++) {
        if (acceptableForecast[i].seenVisibility)
        var visWeight = (Math.abs(acceptableForecast[i].seenVisibility/ MIN_VISIBILITY_KMS));
        
        acceptableForecast[i].visibilityRank = visWeight;
        
        if (acceptableForecast[i].visibilityRank > 1)
            console.log("Something is very wrong.");
    }
    
    return acceptableForecast;
}

function winterRank(acceptableForecast) {
    var IDEAL_TEMP = -2;
    var MAX_TEMP_DIFFERENCE = 8
    
    // Calculate the weights utilized for the sort algorithm
    for (var i = 0; i < acceptableForecast.length; i++) {
        var tempWeight = 0.5 * (Math.abs(acceptableForecast[i].temperature - IDEAL_TEMP))/MAX_TEMP_DIFFERENCE
        var snowChangeWeight = 0.5 * (Math.abs(100-acceptableForecast[i].snow))/100;
        
        acceptableForecast[i]["winterRank"] = tempWeight + snowChangeWeight;
        
        if (acceptableForecast[i].winterRank > 1)
            console.log("Something is very wrong.");
    }
    return acceptableForecast;
}

function winterForecast(hourlyForecast, intent) {
        var NOSNOW = "Not Enough Snow"
        var BAD_TEMP = "Temperature is not optimal for this activity today."
        var snowCheck = false;
        var tempCheck = false;
        var acceptableForecast = []
        
        if (includes(intent, 'winter')){
            //consider temp, snow, snow probability, wind, windchill
            for (var i = 0; i < hourlyForecast.length; i++) {
                // Check within acceptable time 
                if (hourlyForecast[i].time.hours > 7 && hourlyForecast[i].time.hours <= 22) {
                    //Check for acceptable cold temperature
                    if (hourlyForecast[i].temperature < 40 && hourlyForecast[i].temperature > 20){
                        tempCheck = true;
                        //Check for snowfall in mm
                        // if (hourlyForecast[i].snow > 3) {
                            snowCheck = true;
                            // Check for wind chill
                            if (hourlyForecast[i].feelsLike < 40 && hourlyForecast[i].feelsLike > 15) {
                                acceptableForecast.push(hourlyForecast[i]);
                            }   
                        // }   
                    }   
                }  
            }

            if (!snowCheck){
                var result = []
                var pebbleResult = {}
                pebbleResult.time = -1
                pebbleResult.timeString = NOSNOW
                result.push(pebbleResult)
                acceptableForecast = result;
                
            } else if(!tempCheck){
                var result = []
                var pebbleResult = {}
                pebbleResult.time = -1
                pebbleResult.timeString = TEMP
                result.push(pebbleResult)
                acceptableForecast = result;
            } else {
                acceptableForecast = winterRank(acceptableForecast);
            }
        }
    return acceptableForecast
}

function summerForecast(hourlyForecast, intent) {
        var PRECIPITATION = "There is a high chance of precipitation all day."
        var TEMP = "Extreme temperatures all day long. Exercise with caution."
        var precipitationCheck = false; 
        var extremeTempCheck = false;
        var acceptableForecast = []
        
        if (includes(intent, 'summer')) {
            
            for (var i = 0; i < hourlyForecast.length; i++) {
                // Check within acceptable time 
                if (hourlyForecast[i].time.hours > 5 && hourlyForecast[i].time.hours <= 23) {
                    // Check hours with no rain probablities
                    if (hourlyForecast[i].pop < 35) {
                        precipitationCheck = true;
                        // Check temperature min and max
                        if (hourlyForecast[i].temperature > 15 && hourlyForecast[i].temperature < 30) {
                            extremeTempCheck = true;
                            acceptableForecast.push(hourlyForecast[i])
                        } 
                    }
                }
            }
            
            if (!precipitationCheck){
                var result = []
                var pebbleResult = {}
                pebbleResult.time = -1
                pebbleResult.timeString = PRECIPITATION;
                result.push(pebbleResult)
                acceptableForecast = result;
            }
            else if (!extremeTempCheck){
                var result = []
                var pebbleResult = {}
                pebbleResult.time = -1
                pebbleResult.timeString = TEMP;
                result.push(pebbleResult)
                acceptableForecast = result;
            } else {
                acceptableForecast = summerRank(acceptableForecast);
            }
        }
        
    return acceptableForecast;
}

function summerRank(acceptableForecast) {
    const MAX_TEMP_DIFFERENCE = 12;
    const IDEAL_TEMP = 18;
    
    // Calculate the weights utilized for the sort algorithm
    for (var i = 0; i < acceptableForecast.length; i++) {
        var rainWeight = 0.5 * (1 - (acceptableForecast[i].pop/100.0));
        var tempWeight = 0; // if not within range, weight is zero
        if (acceptableForecast[i].temperature <= IDEAL_TEMP + MAX_TEMP_DIFFERENCE)
            if (acceptableForecast[i].temperature >= IDEAL_TEMP - MAX_TEMP_DIFFERENCE)
                tempWeight = 0.5 * (1 - (Math.abs(acceptableForecast[i].temperature - IDEAL_TEMP)/MAX_TEMP_DIFFERENCE));
        
        console.log('Temp: ' + tempWeight);
        console.log('Rain: ' + rainWeight);
            
        acceptableForecast[i].summerRank = tempWeight + rainWeight;
        
        if (acceptableForecast[i].summerRank > 1)
            console.log("Something is very wrong.");
    }
    return acceptableForecast;
}

function timeRank(acceptableForecast, timePreference) {
    for (var i = 0; i < acceptableForecast.length; i++) {
        var timeWeight = 1 - (Math.abs(acceptableForecast[i].time.hours-timePreference)/24);
        acceptableForecast[i].timeRank = timeWeight;
        console.log(timePreference + '  :  ' + timeWeight);
    }
    return acceptableForecast;
}



