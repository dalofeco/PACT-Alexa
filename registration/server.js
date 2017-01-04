// Strict accessing
"use strict";

// ************************ \\
// ******* MODULES ******** \\
// ************************ \\

// Google APIs
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var calendar = google.calendar('v3');

// Validator library
var validator = require('validator');

// File Management
var fs = require('fs');

// Credentials hashing
var credential = require('credential');
var pw = credential();

// Array Includes method
var includes = require('array-includes');

// Server Request Handling
var express = require('express');
var cookieParser = require('cookie-parser');
var app = express();
var bodyParser = require("body-parser");

// **** END OF MODULES ***** //

// ******************************* //
// **** CONSTANT DECLARATIONS **** //
// ******************************* //

const COOKIE_SIGN_SECRET = JSON.parse(fs.readFileSync(__dirname + "/token-secret.json")).secret;
const COOKIE_EXPIRY_MINUTES = 15;

const EMAIL_WHITELIST = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@._";
const PASSWORD_WHITELIST = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890@._+,!#$%&()";



// ****************************** //
// ***** EXPRESS MIDDLEWARE ***** //
// ****************************** //

// Parse url encoded parameters automatically
app.use(bodyParser.urlencoded({
    extended: false
}));

// Cookie parsing
app.use(cookieParser(COOKIE_SIGN_SECRET));

// Automatically parse json bodies
app.use(bodyParser.json());

// Server static pages
app.use('/css', express.static('css'));
app.use('/fonts', express.static('fonts'));
app.use('/js', express.static('js'));

// ********************** \\
// **** CLIENT DATA ***** \\
// ********************** \\

// Load client info from file store
function loadClient(pactID, callback) {
    var filepath = generateClientFilePath(pactID);

    fs.stat(filepath, function(err, stats) {
        if (err === null) {
            fs.readFile(filepath, function(err, data) {
                if (err) {
                    console.log(err);
                    return;
                } else if (data != '') {
                    callback(JSON.parse(data));
                }
            });
        } else {
            console.log("Client for pactID" + pactID + " does not exist");
        }
    });
}

// Save client info to file store
function saveClient(client) {
    var filepath = generateClientFilePath(client.pactID);
    
    fs.writeFile(filepath, JSON.stringify(client), function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log('Saved: ' + filepath + ' successfully!');
        }
    });
}

// To store new registering clients
var NEW_CLIENTS = {};
// To store generated ids awaiting Google API connecition
var PENDING_IDS = [];


// Provide access to genereate unique id for registration
app.get('/genID', function(req, res) {
    var id = generateNewPactID();
    res.send(id);
});


function generateNewPactID() {
// Generates a unique pact ID and adds it to pending ids (for user registration)
// Input: response object from user http request
// Output: unique pact ID string
    var again = true;
    var newID;
    var filepath;    
    
    while(again) { // To make sure no duplicate ID is generated
        newID = Math.random().toString(36).substr(2, 16);
        
        // Generate filepath for new ID
        filepath = generateClientFilePath(newID);
        
        // Make sure ID is not taken making sure file does not exist
        if (fs.existsSync(filepath)) {
            again = true;
        } else {
            again = false;
        }
    }
    PENDING_IDS.push(newID);
    
    return newID;
}

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/pages/index.html');
});

// Provide the pact registration page
app.get('/register', function(req, res) {
    res.sendFile(__dirname + '/pages/register.html');
});

app.get('/login', function(req, res) {
    res.sendFile(__dirname + '/pages/login.html');
});

app.get('/logout', function(req, res) {
    // Callback only gets executed if successfully authenticated
    if (req.signedCookies.pactID && req.signedCookies.token) {
        authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {
            if (success) {
                logout(pactID);
            }
            res.cookie('token', '', {expires: new Date(0)});
            res.cookie('pactID', '', {expires: new Date(0)});
            
            res.redirect("/");
        });
    } else {
        console.log("Not logged in to logout");
    }
});

app.get('/success', function(req, res) {
    res.sendFile(__dirname + '/pages/success.html');
});


app.post('/login', function(req, res) {

    // Make sure both parameters are specified
    if (req.body.email && req.body.password) {

        // Get parameters
        var email = req.body.email;
        var password = req.body.password;

        // Validate EMAIL
        if (validator.isEmail(email) && validator.isWhitelisted(email, EMAIL_WHITELIST)) {
            
            // Validate password
            if (validator.isWhitelisted(password, PASSWORD_WHITELIST)) {

                // Convert to lower case
                email = email.toLowerCase();

                // Authenticate user and redirect 
                authenticateUser(email, password, false, function(success, authToken, pactID) {
                    if (success) {
                        // Set expiry to fifteen minutes
                        var expiryTime = Date.now() + (COOKIE_EXPIRY_MINUTES * 60 * 1000);
                        // Generate and set auth token as cookie for valid login
                        res.cookie('token', authToken, {signed: true, secure: true, expiry: new Date(expiryTime)});
                        res.cookie('pactID', pactID, {signed: true, secure: true, expiry: new Date(expiryTime)});

                        res.redirect("/settings");
                    } else {
                        res.redirect("/login?fail=true");
                    }
                });
            } else {
                res.redirect("/login?fail=true");
                console.log("Illegal characters in password");
            }
        } else {
            res.redirect("/login?fail=true");
            console.log("Illegal characters in email");
        }
    } else {
        res.redirect("/login?fail=true");
    }
});

// Handle user request to register form information
app.post('/register', function(req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var confirmPassword = req.body.confirmPassword;
    var pactID = req.body.pactid;
        
    var latitude = req.body.latitude;
    var longitude = req.body.longitude;
    
    if (email && pactID && password && latitude && longitude) {

        // Validate all input fields
        if (!validator.isEmail(email) || !validator.isWhitelisted(email, EMAIL_WHITELIST)) {
            res.send("Invalid email!");
            return;
        } if (!validator.isWhitelisted(password, PASSWORD_WHITELIST) || !validator.isWhitelisted(confirmPassword, PASSWORD_WHITELIST)) {
            res.send("Illegal characters in password!");
            return;
        } if (password.length < 7) {
            res.send("Password too short! It must be at least 7 characters long!");
            return;
        } if (!validator.isAlphanumeric(pactID)) {
            res.send("Invalid pactID");
            return;
        } if (!validator.isDecimal(latitude) || !validator.isDecimal(longitude)) {
            res.send("Invalid coordinates");
            return;
        } if (password != confirmPassword) {
            res.redirect("/register?fail=true");
            return;
        }

        email = email.toLowerCase();

        if (latitude === 0 || longitude === 0) {
            res.redirect('/register?fail=true');
            return;
        }

        pw.hash(password, function(err, hash) {
            if (err) {
                console.log("Error hashing password: " + err);
            }
            if (includes(PENDING_IDS, pactID)) {
                NEW_CLIENTS[email] = {email: email, 
                                      pactID: pactID, 
                                      password: hash,
                                      latitude: latitude, 
                                      longitude: longitude};
                

                registerTokenForPact(pactID, res);
                delete PENDING_IDS[pactID];
            } else {
                res.send("Invalid ID!");
            }
        });
    } else {
        res.send('Missing field!');
    }
});

app.get('/settings', function(req, res) {
    if (req.signedCookies.token && req.signedCookies.pactID) {
        
        // Validate token and pact id cookies
        if (validator.isAlphanumeric(req.signedCookies.token) && validator.isAlphanumeric(req.signedCookies.pactID)) {

            authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {
                if (success) {
                    res.sendFile(__dirname + "/pages/settings.html");
                }
                else {
                    res.redirect('/login');
                }
            });
        } else {
            res.send("Chill out with those illegal cookies...");
        }
    } else {
        res.redirect("/login");
    }
});

app.get('/editLocation', function(req, res) {
    res.sendFile(__dirname + "/pages/editLocation.html");
});

app.post('/editLocation', function(req, res) {
    
    if (req.signedCookies.token && req.signedCookies.pactID && req.body.latitude && req.body.longitude) {
        
        // Validate all cookie fields
        if (!validator.isAlphanumeric(req.signedCookies.token)) {
            res.send("Chill out with that illegal token!");
            return;
        } if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            res.send("Chill out with that illegal pactID!");
            return;
        } if (!validator.isDecimal(req.body.latitude) || !validator.isDecimal(req.body.longitude)) {
            res.send("Yeah... those are NOT valid coordinates!");
            return;
        }
        
        // If token is authenticated
        authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {
            if (success) {
                loadClient(pactID, function(client) {
                    client.location.latitude = req.body.latitude;
                    client.location.longitude = req.body.longitude;

                    saveClient(client);

                    res.redirect("/editLocation");
                    return;
                }); 
            } else {
                // Failed to authenticate, redirect to login and clear cookies
                res.cookie('token', '', {expires: new Date(0)});
                res.cookie('pactID', '', {expires: new Date(0)});
                res.redirect('/login');
            }
        });
    } else {
    // Missing parameters or cookie not set
        res.redirect('/login');
    }
});


// ************************************************ \\
// *********** CREDENTIAL MANAGEMENT ************** \\
// ************************************************ \\

function storeCredentials(client) {
    var userCredentials = {
        email: client.email,
        password: client.password,
        pactID: client.pactID
    };
    
    var filepath = generateCredentialsFilePath(client.email);
    
    // Make sure file does not already exist (email not registered already)
    fs.stat(filepath, function(err, stats) {
        if (err.code === 'ENOENT') {
            // Write object to file
            fs.writeFile(filepath, JSON.stringify(userCredentials), function(err) {
                if (err) {
                    console.log("Could not write file: " + filepath + ". Error: " + err);
                }
            });
        } else {
            console.log("Email already exists.");
        }
    });
        
}

function logout(pactID) {
    var filepath = generateAuthTokenFilePath(pactID);
    // Make sure file exists
    fs.stat(filepath, function(err, stats) {
        if (err == null) {
            fs.unlink(filepath, function(err) {
                if (err) {
                    console.log("Could not delete token: " + filepath + ". Error: " + err);
                }
            });
        } else {
            console.log("Client file for pactID: " + pactID + " does not exist");
        }
    });
}

function authenticateToken(pactID, token, callback) {
    
    // Make sure both parameters are not null
    if (token && pactID) {
        console.log("Token Cookie: " + token);

        var filename = generateAuthTokenFilePath(pactID);
        fs.stat(filename, function(err, stats) {
            
            // If file exists
            if (err == null) {
            
                fs.readFile(filename, function(err, obj) {
                    if (err) {
                        console.log("Could not read file: " + filename + ". Error: " + err);
                        return;
                    } 

                    var tokenObj = JSON.parse(obj);

                    console.log('Loaded Token Value: ' + tokenObj.value);
                    console.log('Loaded Token ID: ' + tokenObj.id);

                    console.log("TokenExpiry: " + tokenObj.expires);
                    console.log("CurrentTime: " + Date.now());

                    // Validate stored token and ID match the ones in cookie
                    if (tokenObj.value === token && tokenObj.id === pactID) {

                        if (tokenObj.expires+1 > Date.now() + 1) {

                            // Callback function success and pactID as parameter
                            callback(true, pactID);

                        } else {
                            console.log("Token is expired");
                            // Delete token file (it is expired)
                            fs.unlink(filename, function(err) {
                                if (err) {
                                    console.log("Could not delete token: " + filename + ". Error: " + err);
                                }
                            });
                            // Callback with false login
                            callback(false, pactID);
                        }

                    } else {
                        console.log("Token mismatch");
                        // If login invalid, delete token file
                        fs.unlink(filename, function(err) {
                            if (err) {
                                console.log("Could not delete token: " + filename + ". Error: " + err);
                            }
                        });
                        // Re-direct to login page
                        callback(false, pactID);
                    }
                });
            } else { 
                // File does not exist, invalid cookies
                console.log("token file for pactID does not exist: clearing cookie");
                callback(false, pactID);
            }
        });
    } else {
        // Cookie not provided, redirect to login
        callback(false, null);
    }
}

function authenticateUser(email, password, alexa, callback) {
// Authenticates user email and password combination, and stores auth token in user's cookie
    
    var filepath = generateCredentialsFilePath(email);
    
    if (!alexa)
        alexa = false;
    
    // Verify file exists
    fs.stat(filepath, function(err, stats) {
        // If no error, file exists
        if (err == null) {
    
            // Read file
            fs.readFile(filepath, function(err, obj) {
                if (err) {
                    console.log("Could not read file: " + filepath + ". Error: " + err);
                    // Unsuccessful (login) callback
                    callback(false, null, null);
                    return;
                }

                // Parse JSON object
                obj = JSON.parse(obj);

                // Verify password hash matches passed in password
                pw.verify(obj.password, password, function(err, isValid) {
                    if (err) {
                        console.log(err);
                        callback(false, null, null);
                    } else if (isValid) {
                        var authToken = generateAuthToken(obj.pactID, alexa);
                        callback(true, authToken, obj.pactID);
                    } else {
                        callback(false, null, null);
                    }
                });
            });
        } else {
            // File does not exists (user not registered)
            callback(false, null, null);
        }
    });
}

function generateAuthToken(pactID, alexa) {
// Generates an auth token for pactID, stores it locally for future authentication, and returns the cookie value
    
    // Generate random string
    var authTokenString = randomString(30);
    
    var expiryTime;
    
    if (alexa) {
        expiryTime = Date.now() + (365 * 24 * 60 * 60 * 1000);
    } else {
        // Set expiry to 15 minutes (900 seconds [900000 ms])
        expiryTime = (Date.now() + (COOKIE_EXPIRY_MINUTES * 60 * 1000));
    }
    
    // Store authtoken
    var token = {
        id: pactID,
        expires: expiryTime, // value in milliseconds (Unix Epoch Time)
        value: authTokenString
    };
    
    var filepath = generateAuthTokenFilePath(pactID);
    
    // Add token to store
    fs.writeFile(filepath, JSON.stringify(token), function(err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Successfully saved token: " + token + " to " + filepath);
        }
    });
    
    return authTokenString;
}

 function randomString(length) {
     var text = "";
     var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
     var i;
     for (i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
     }
     
     return text;
}   

// ************************************************* \\
// ********* ALEXA SKILL REGISTRATION ************** \\
// ************************************************* \\

app.get('/alexaLocation', function(req, res) {
    if (req.query.authToken && validator.isAlphanumeric(req.query.authToken)) {
        if (req.query.authToken.length == 46) {
            var token = req.query.authToken.substr(0, 30);
            var pactID = req.query.authToken.substr(30, 16);
        
            authenticateToken(pactID, token, function(success) {
                if (success) {
                    loadClient(pactID, function(client) {
                        res.send(client.location);
                    });
                } else {
                    console.log("/alexaLocation Authentication failed");
                    res.send({failed:true});
                }
            });
            
        } else {
            console.log("Token length incorrect");
        }
    } else {
        console.log("Invalid token");
    }
});

app.get('/alexaAuth', function(req, res) {
    
    res.sendFile(__dirname + "/pages/alexaLogin.html");
    
//    if (req.query.state && req.query.client_id && req.query.response_type && req.query.redirect_uri) {
//        var state = req.query.state;
//        var client_id = req.query.client_id;
//        var response_type = req.query.response_type;
//        var redirect_uri = req.query.redirect_uri;
//        
//        
//    }
    
});

app.post('/alexaAuth', function(req, res) {
    
    if (req.body.state && req.body.client_id && req.body.response_type && req.body.redirect_uri) {
    
        var state = req.body.state;
        var client_id = req.body.client_id;
        var response_type = req.body.response_type;
        var redirect_uri = req.body.redirect_uri;

        if (req.body.email && req.body.password) {
            
            // Validate email and password
            if (validator.isEmail(req.body.email) && validator.isWhitelisted(req.body.email, EMAIL_WHITELIST)) {
                if (validator.isWhitelisted(req.body.password)) {
                    var email = req.body.email;
                    var password = req.body.password;

                    authenticateUser(email, password, true, function(success, authToken, pactID) {
                        if (success) {
                            var accessToken = authToken + pactID;
                            res.redirect(redirect_uri + "?access_token=" + accessToken + "&state=" + state + "&token_type=token");
                        } else {
                            res.redirect('/alexaAuth?fail=true');
                        }
                    });
                }
            }
        }
    }    
});

// ************************************************ \\
// ********** EVERTHING GOOGLE APIS *************** \\
// ************************************************ \\

// If modifying these scopes, delete your previously saved credentials

var GOOGLE_API_SCOPES = ['https://www.googleapis.com/auth/calendar', 
                         'https://www.googleapis.com/auth/plus.login',
                         'email'];

// GET Request with GOOGLE USER AUTHENTICATION CODE
app.get('/googleAuth', function(req, res) {
    //res.sendFile(__dirname + '/success.html')
    var code = req.query.code;
    console.log("This must be validated: GoogleAuth code: " + code);
    
    if (code) {

        // Load client secrets from a local file.
        fs.readFile('client_secret.json', function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            
            var credentials = JSON.parse(content);
            var clientSecret = credentials.web.client_secret;
            var clientId = credentials.web.client_id;
            var redirectUrl = credentials.web.redirect_uris[0];
            var auth = new googleAuth();
            var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
            
        
            oauth2Client.getToken(code, function(err, token) {
                if (err) {
                    console.log('Error while trying to retrieve access token', err);
                    return;
                }
                
                oauth2Client.credentials = token;
                // Get the PactID and store it with PactID in filename
                getClientPactIdAndStore(oauth2Client, token, res);
            });
        
        });
    }
});
                         
function registerTokenForPact(pactID, res) {
    var token_path = generateGoogleTokenPath(pactID);
    
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
      if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
      }
      // Authorize a client with the loaded credentials, then call the callback
      register(JSON.parse(content), token_path, res);
    });
}

function register(credentials, token_path, res) {
    var clientSecret = credentials.web.client_secret;
    var clientId = credentials.web.client_id;
    var redirectUrl = credentials.web.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(token_path, function(err, token) {
        if (err) {
            generateNewToken(oauth2Client, res);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            console.log("User already registered!");
        }
    });
}

function generateNewToken(oauth2Client, res) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: GOOGLE_API_SCOPES
    });
    res.redirect(authUrl);
}


function getTokenForPact(pactID, callback, param) {

    var token_path = generateGoogleTokenPath(pactID);
    
    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }

        // Authorize a client with the loaded credentials, then call the callback
        if (param) {
            authorize(JSON.parse(content), callback, token_path, pactID, param);
        } else {
            authorize(JSON.parse(content), callback, token_path, pactID);
        }
    });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, token_path, pactID, param) {
    var clientSecret = credentials.web.client_secret;
    var clientId = credentials.web.client_id;
    var redirectUrl = credentials.web.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(token_path, function(err, token) {
        if (err) {
            console.log("User must register first!");
        } else {
            oauth2Client.credentials = JSON.parse(token);
            if (param) {
                callback(oauth2Client, param);
            } else {
                callback(oauth2Client);
            }
        }
    });
}

function getClientPactIdAndStore(oauth2Client, token, res) {
    var plus = google.plus('v1');
    var request = plus.people.get({
        'userId' : 'me',
        'fields': 'emails',
        'auth': oauth2Client
    }, function(err, response) {
        if (err) {
            console.log(err);
            return;
        } else {
            var email = response.emails[0].value;
            
            // Make sure email matches the original one
            if (NEW_CLIENTS[email]) {
                var pactID = NEW_CLIENTS[email].pactID;
                var longitude = NEW_CLIENTS[email].longitude;
                var latitude = NEW_CLIENTS[email].latitude;

                // Save credentials
                storeCredentials(NEW_CLIENTS[email]);

                delete NEW_CLIENTS[email]; // delete pending registering user once it is processed

                if (pactID == null) {
                    console.log("Couldn't retrieve local pact id from NEW_CLIENTS");
                } else {
                    storeToken(token, pactID, email, latitude, longitude, res);
                }
            } else {
                delete NEW_CLIENTS[email];
                res.send("Error: mismatching emails...<br>If the Google log-in screen did not show up, try using Icognito mode, or signing out of the active Google account session.");
            }
        }
    });
}

function generateGoogleTokenPath(pactID) {
    return __dirname + '/store/credentials/goo-api-tok-' + String(pactID) + '.json';
}

function generateClientFilePath(pactID) {
    return __dirname + "/store/clients/" + String(pactID) + ".json";
}

function generateCredentialsFilePath(email) {
     return __dirname + "/store/credentials/" + String(email) + '.json';
}

function generateAuthTokenFilePath(pactID) {
    return __dirname + "/store/tokens/" + String(pactID) + ".json";
}

function deleteDataForPactID(pactID) {

    if (pactID) {
        var clientfilepath = generateClientFilePath(pactID);
        
        fs.stat(clientfilepath, function(err, stats) {
            
            // Check for errors and log
            if (err) {
                console.log(err);
                return;
            }
            
            fs.readFile(clientfilepath, function(err, obj) {
                if (err) {
                    console.log("Could not read file: " + clientfilepath + ". Error: " + err);
                }
                
                var email = JSON.parse(obj).email;

                // Delete client file
                fs.unlink(clientfilepath, function(err) {
                    if (err) {
                        console.log(err);
                    }
                });

                // Delete google token
                fs.unlink(generateGoogleTokenPath(pactID), function(err) {
                    if (err) {
                        console.log(err);
                    }
                });

                // Delete credential file
                fs.unlink(generateCredentialsFilePath(email), function(err) {
                    if (err) {
                        console.log(err);
                    }
                });
                
                // Delete auth token
                fs.unlink(generateAuthTokenFilePath(pactID), function(err) {
                    if (err) {
                        console.log(err);
                    }
                });

                console.log('Successfully deleted all data for ' + pactID + '(' + email + ')');
            });
        });
    }
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token, pactID, email, latitude, longitude, res) {
    var token_path = generateGoogleTokenPath(pactID);
    
   fs.stat(token_path, function(err, stats) {
       if (err === null) {
           console.log("Token for pact ID: " + pactID + " already exists!");
           return;
        }
   });
    
    fs.writeFile(token_path, JSON.stringify(token), function(err) {
        if (err) {
            console.log("Could not write token to: " + token_path + ". Error: " + err);
            return;
        }
    });
    
    var client = {'pactID': pactID, 
                  'email': email,
                  'location': {'latitude': latitude,
                               'longitude': longitude}
                 };
                    
    saveClient(client);
    
    console.log('Token stored to ' + token_path);
    res.redirect('/success');
}

app.get('/list', function(req, res) {
    
    // Make sure cookies are set
    if (req.signedCookies.pactID && req.signedCookies.token) {      
        // Validate PACT ID
        if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            res.send("Chill out with that illegal PACT ID");
            return;
        }
        // Validate token
        if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            res.send("Chill out with that illegal token!");
            return;
        }
        
        authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {   
            if (success) {
                getTokenForPact(pactID, fetchEvents, pactID);
            } else {
                // Redirect and clear cookies (failed login)
                res.cookie('token', '', {expires: new Date(0)});
                res.cookie('pactID', '', {expires: new Date(0)});
                res.redirect("/login");
            }
        });
        
    } else {
        res.redirect("/login");
    }
});

app.get('/location', function(req, res) {
    
    if (req.signedCookies.pactID && req.signedCookies.token) {
        
        // Validate PACT ID
        if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            console.log("Illegal PACT ID");
            res.send({failed: true});
            return;
        }
        // Validate token
        if (!validator.isAlphanumeric(req.signedCookies.token)) {
            console.log("Illegal token!");
            res.send({failed: true});
            return;
        }
        
        // Attempt to authenticate cookie token
        authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {
            if (success) {
                loadClient(pactID, function(client) {
                    res.send({
                        latitude: client.location.latitude,
                        longitude: client.location.longitude
                    });
                });
                
            // Failed to authenticate token
            } else {
                console.log("Login failed");
                res.cookie('pactID', '', {expires: new Date(0)});
                res.cookie('token', '', {expires: new Date(0)});
                res.send({failed: true});
                return;
            }
        });
    } else {
        res.send({failed: true});
    }
});

app.get('/delete', function(req, res) {
    if (req.signedCookies.pactID && req.signedCookies.token) {
        
        // Validate PACT ID
        if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            res.send("Chill out with that illegal PACT ID!");
            return;
        }
        // Validate token
        if (!validator.isAlphanumeric(req.signedCookies.pactID)) {
            res.send("Chill out with that illegal token!");
            return;
        }
        
        // Attempt to authenticate via token
        authenticateToken(req.signedCookies.pactID, req.signedCookies.token, function(success, pactID) {
            if (success) {
                // Delete 
                deleteDataForPactID(pactID);
                res.redirect("/success");
            } else {
                res.redirect("/login");
            }
            // Delete cookies
            res.cookie('token', '', {expires: new Date(0)});
            res.cookie('pactID', '', {expires: new Date(0)});
        });
        
    } else {
        // Cookies not set, redirect to login page
        res.redirect("/login");
    }
});

function getUserSchedule(pactID) {
    // If pactID's calendar was updated more than fifteen minutes ago
    if ((Date.now() - CLIENTS[pactID].updateTime) > (900 * 1000)) {
        // get user schedule and store it to CLIENTS[pactID].schedule[]
        getTokenForPact(pactID, fetchEvents, pactID);
    }
}

/**
 * Fetches the next 10 events on the user's primary calendar and saves locally
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client. and a registered pactID string
 */
function fetchEvents(auth, pactID) {
    calendar.events.list({
        auth: auth,
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length == 0) {
            console.log('No upcoming events found.');
        } else {
            console.log('Upcoming 10 events:');
            
            var i;
            for (i = 0; i < events.length; i++) {
                var event = {
                    'start': events[i].start.dateTime,
                    'end': events[i].end.dateTime,
                    'title': events[i].summary,
                    'timeZone': events[i].start.timeZone
                };
                
                CLIENTS[pactID].schedule.push(event);
            }
            console.log(CLIENTS[pactID]);
        }
    });
}


// Boilerplate code for creating a new event
function createEvent(auth, eventDetails) {
    var event = {
        'summary': eventDetails.title,
        'location': eventDetails.location,
        'description': eventDetails.description,
        'start': {
            'dateTime': eventDetails.startTime, //'2015-05-28T09:00:00-07:00',
            'timeZone': eventDetails.timeZone //'America/Los_Angeles',
        },
        'end': {
            'dateTime': eventDetails.endTime,
            'timeZone': eventDetails.timeZone
        },
        // 'recurrence': ['RRULE:FREQ=DAILY;COUNT=2'],
        //'attendees': [ 
        //    {'email': 'lpage@example.com'},
        //    {'email': 'sbrin@example.com'},
       // ],
        'reminders': {
            'useDefault': false,
            'overrides': [
                {'method': 'email', 'minutes': 30},
                {'method': 'popup', 'minutes': 20}
            ]
        }
    };
    
    calendar.events.insert({
      auth: auth,
      calendarId: 'primary',
      resource: event
    }, function(err, event) {
      if (err) {
        console.log('There was an error contacting the Calendar service: ' + err);
        return;
      }
      console.log('Event created: %s', event.htmlLink);
    });
}

// ****************************** \\
// ***** END OF GOOGLE APIS ***** \\
// ****************************** \\

// Open up the server to listen for incoming connections
var server = app.listen(process.env.PORT || '8080', '0.0.0.0', function() {
    if (process.env.PORT) {
        console.log('Server started at: https://www.pact.dalofeco.com');
        console.log(new Date());
    } else {
        console.log('App listening at http://%s:%s', server.address().address, server.address().port);
        console.log(new Date());
    }
});