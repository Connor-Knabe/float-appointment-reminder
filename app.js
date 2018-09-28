//Google Cal Api
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

//Twilio and parse
var twilioKey = require('./twilioApiKey.js');
var parseKey = require('./parseApiKey.js');
var twilioInfo = require('./twilioInfo.js');
var twilio = require('twilio');
var client = twilio(twilioKey.ACCOUNT_SID, twilioKey.AUTH_TOKEN);
var Parse = require('parse/node');
Parse.initialize(parseKey.APP_ID, parseKey.API_KEY);

//Web app
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));
var port = process.env.PORT || 2600;
var router = express.Router();
app.use('/', router);
app.listen(port);
var CronJob = require('cron').CronJob;
var moment = require('moment');
var moment = require('moment-timezone');

console.log('Magic happens on port ' + port + ' - ' + new Date());

var options = {
	noColor: true
};

var auth = require('http-auth');
var basic = auth.basic({
	realm: 'Private area',
	file: __dirname + '/htpasswd'
});

app.use(auth.connect(basic));

//Twilio

//Parse
//sendMessage();

function start(res, name) {
	// Load client secrets from a local file.
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
		if (err) {
			console.log('Error loading client secret file: ' + err);
			return;
		}
		// Authorize a client with the loaded credentials, then call the
		// Google Calendar API.
		authorize(JSON.parse(content), listEvents, res, name);
	});
}

start();

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, res, name) {
	var clientSecret = credentials.installed.client_secret;
	var clientId = credentials.installed.client_id;
	var redirectUrl = credentials.installed.redirect_uris[0];
	var auth = new googleAuth();
	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			getNewToken(oauth2Client, callback);
		} else {
			oauth2Client.credentials = JSON.parse(token);
			callback(oauth2Client, res, name);
		}
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
	var authUrl = oauth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES
	});
	console.log('Authorize this app by visiting this url: ', authUrl);
	var rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	rl.question('Enter the code from that page here: ', function(code) {
		rl.close();
		oauth2Client.getToken(code, function(err, token) {
			if (err) {
				console.log('Error while trying to retrieve access token', err);
				return;
			}
			oauth2Client.credentials = token;
			storeToken(token);
			callback(oauth2Client);
		});
	});
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
	try {
		fs.mkdirSync(TOKEN_DIR);
	} catch (err) {
		if (err.code != 'EEXIST') {
			throw err;
		}
	}
	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
	console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, res, name) {
	var calendar = google.calendar('v3');
	var today = new Date();
	var tomorrow = new Date();
	tomorrow.setDate(today.getDate() + 1);
	calendar.events.list(
		{
			auth: auth,
			calendarId: 'primary',
			timeMin: today.toISOString(),
			timeMax: tomorrow.toISOString(),
			singleEvents: true,
			orderBy: 'startTime'
		},
		function(err, response) {
			if (err) {
				console.log('The API returned an error: ' + err);
				return;
			}
			var events = response.items;
			if (events.length == 0) {
				console.log('No upcoming events found.');
			} else {
				var count = 0;
				for (var i = 0; i < events.length; i++) {
					var event = events[i];
					var eventSummary = event.summary;
					var start = event.start.dateTime || event.start.date;
					var floatTime = eventSummary.match(/\d+/g);
					var parsedName = eventSummary.split(' ')[0];
					var phoneNumber = null;
					console.log('date' + event.start.dateTime);
					var time = new Date(event.start.dateTime);
					var cstTime = moment.tz(time, 'America/Chicago').format();
					console.log('CST' + cstTime);
					var isFirstFloat = false;
					var isNonRoommate = floatTime[1] === '00' || floatTime[1] === '01';

					if (floatTime[1]) {
						if (floatTime[1] === '00') isFirstFloat = true;
					}
					if (event.description) {
						phoneNumber = parsePhone(event.description);
						phoneNumber = phoneNumber[0];
					}

					checkForNumber(parsedName, phoneNumber, time, isFirstFloat, isNonRoommate).then(function(returnFloateeObj) {
						var verifiedName;
						var verifiedNumber;
						var verifiedTime;
						var verifiedIsNonRoommate;
						var isFirstFloat = floatTime[1] === '00';
						if (returnFloateeObj) {
							verifiedName = returnFloateeObj.verifiedName;
							verifiedNumber = returnFloateeObj.verifiedNumber;
							verifiedTime = returnFloateeObj.verifiedTime;
							verifiedisFirstFloat = returnFloateeObj.verifiedisFirstFloat;
							verifiedIsNonRoommate = returnFloateeObj.verifiedIsNonRoommate;
							console.log(verifiedIsNonRoommate);
							console.log('Verified');
							cstTime = moment.tz(verifiedTime, 'America/Chicago').format('h:mm:ss a');
						}
						console.log(returnFloateeObj);
						if (verifiedNumber) {
							console.log('is verified');
							setFloatConfirmation(verifiedName, null, null, isFirstFloat);
							console.log('number found' + verifiedNumber);
							var message = 'You have a float today at ' + cstTime + '. Please text back Y or N to confirm or cancel your float.';
							console.log(message);
							console.log(verifiedIsNonRoommate);
							//check for roommmate
							if (verifiedIsNonRoommate) {
								sendMessage(verifiedNumber, message);
							}
						} else {
							console.log('no number found');
						}
					});

					// console.log(event);
					// console.log("\n"+event.description);

					console.log('%s - %s', start, event.summary);
				}
			}
		}
	);
}

var setFloatConfirmation = function(name, number, isFloatConfirmed, isFirstFloat) {
	var Floatee = Parse.Object.extend('Floatee');
	var query = new Parse.Query(Floatee);
	if (name) {
		console.log('name is' + name);
		query.equalTo('Name', name);
	} else if (number) {
		console.log('Number is' + number);
		query.equalTo('PhoneNumber', number);
	} else {
		console.log('Error name or phone not found');
		return;
	}
	var promise = new Parse.Promise();
	query.first().then(function(result) {
		result.set('isFloatConfirmed', isFloatConfirmed);
		result.set('isFirstFloat', isFirstFloat);
		result.save();
		promise.resolve(result);
	});
	return promise;
};

var checkForNumber = function(name, phone, time, isFirstFloat, isNonRoommate) {
	var returnFloateeObj = {};
	var promise = new Parse.Promise();
	fetchPhoneNumber(name).then(function(result) {
		var floatee = result || {};
		if (phone && Object.getOwnPropertyNames(floatee).length == 0) {
			insertPhoneNumber(name, phone).then(function(floatee) {
				//Inserting phone number
				var phoneNum = floatee.get('PhoneNumber');
				returnFloateeObj = { verifiedName: name, verifiedNumber: phoneNum, verifiedTime: time, verifiedisFirstFloat: isFirstFloat, verifiedIsNonRoommate: isNonRoommate };
				promise.resolve(returnFloateeObj);
			});
		} else if (Object.getOwnPropertyNames(floatee).length != 0) {
			//existing object from parse fetched
			var phoneNum = floatee.get('PhoneNumber');
			returnFloateeObj = { verifiedName: name, verifiedNumber: phoneNum, verifiedTime: time, verifiedisFirstFloat: isFirstFloat, verifiedIsNonRoommate: isNonRoommate };
			promise.resolve(returnFloateeObj);
		} else {
			//nada
			promise.resolve();
		}
	});
	return promise;
};

var insertPhoneNumber = function(name, phone) {
	var Floatee = Parse.Object.extend('Floatee');
	var floatee = new Floatee();
	var floateeObj = { Name: name, PhoneNumber: phone };
	var promise = new Parse.Promise();
	floatee.save(floateeObj).then(function(floatee) {
		promise.resolve(floatee);
	});
	return promise;
};

var fetchPhoneNumber = function(name) {
	var Floatee = Parse.Object.extend('Floatee');
	var query = new Parse.Query(Floatee);
	query.equalTo('Name', name);
	var promise = new Parse.Promise();
	query.first().then(function(result) {
		promise.resolve(result);
	});
	return promise;
};

var fetchNameFromPhone = function(number) {
	console.log('NUM' + number);
	var Floatee = Parse.Object.extend('Floatee');
	var query = new Parse.Query(Floatee);
	query.equalTo('PhoneNumber', number);
	var promise = new Parse.Promise();
	query.first().then(function(result) {
		console.log('RESULT', result);
		promise.resolve(result);
	});
	return promise;
};

function sendMessage(phoneNumber, message) {
	console.log('phone' + phoneNumber);
	client.messages.create(
		{
			to: phoneNumber,
			from: twilioInfo.fromNumber,
			body: message
		},
		function(err, messageRes) {}
	);
}

router.get('/', function(req, res) {
	//start(res);
	res.send('{}');
});

function sendTwilioResponse(responseMessage, res) {
	var resp = new twilio.TwimlResponse();
	resp.message(responseMessage);
	res.writeHead(200, {
		'Content-Type': 'text/xml'
	});
	res.end(resp.toString());
}

router.post('/sms', function(req, res) {
	console.log('SMS recieved');
	console.log(req.body.From);
	var incomingPhoneNumber = req.body.From;
	var parsedPhoneNumber = parsePhone(incomingPhoneNumber);
	parsedPhoneNumber = parsedPhoneNumber[0];

	var msg = {
		sid: req.body.MessageSid,
		type: 'text',
		textMessage: req.body.Body,
		fromCity: req.body.FromCity,
		fromState: req.body.FromState,
		fromCountry: req.body.FromCountry
	};

	console.log(new Date() + 'Message recieved: ' + msg.textMessage + ' From: ' + req.body.From);
	var incomingMessage = msg.textMessage.toLowerCase();
	var responseMessage = 'Please only message Y for yes and N for No. Thanks!';
	var alertMessage;

	message = "Tips:\nSwimsuit not necessary\n\nNothing to bring\n\nNo caffeine before\n\nDon't shave day of\n\nLight meal an hour before tank\n\n Address is:";

	fetchNameFromPhone(parsedPhoneNumber).then(function(result) {
		var floateeName = 'null';
		var isFirstFloat = false;
		if (result) {
			floateeName = result.get('Name');
			isFirstFloat = result.get('isFirstFloat');
		}
		if (incomingMessage === 'y') {
			responseMessage = 'We have confirmed your float! See you soon!';
			setFloatConfirmation(null, parsedPhoneNumber, true);
			alertMessage = floateeName + ': ' + parsedPhoneNumber + ' has confirmed';
			sendMessage(twilioInfo.connorCell, alertMessage);
			if (isFirstFloat) {
				message = "Tips:\nSwimsuit not necessary\n\nNothing to bring\n\nNo caffeine before\n\nDon't shave day of\n\nLight meal an hour before tank\n\n Address is:";
				setInterval(function() {}, 0.5 * 60 * 1000);
				sendMessage(incomingPhoneNumber, message);
			}
		} else if (incomingMessage === 'n') {
			responseMessage = 'We are sorry you cannot make it, please text ' + twilioInfo.connorCell + ' to book another time!';
			setFloatConfirmation(null, parsedPhoneNumber, false);
			alertMessage = parsedPhoneNumber + ' has canceled';
			sendMessage(twilioInfo.connorCell, alertMessage);
		}
		sendTwilioResponse(responseMessage, res);
	});
});

var job = new CronJob(
	'0 21 8 * * *',
	function() {
		//runs every Monday at 9:55am
		start();
	},
	function() {
		/* This function is executed when the job stops */
	},
	true /* Start the job right now */,
	'America/Chicago'
);

function parsePhone(str) {
	var minimum = 10; // typical minimum phone number length
	var count = 0;
	this.items = [];

	var items = (this.items = []);

	var i = 0,
		n = '',
		min = minimum;

	while (i < str.length) {
		switch (str[i]) {
			case '+': // start of international number
				i++;
				break;
			case '-':
			case '.':
			case '(':
			case ')': // ignore punctuation
				break;
			case ' ':
				if (n.length >= min) {
					// space after consuming enough digits is end of number
					items.push(n);
					n = '';
				}
				break;
			default:
				if (str[i].match(/[0-9]/) && count <= 9) {
					// add digit to number
					n += str[i];
					count++;
				} else {
					if (n.length >= min) {
						items.push(n); // else end of number
					}
					n = '';
				}
				break;
		}
		i++;
	}

	if (n.length >= min) {
		// EOF
		items.push(n);
	}
	return items;
}
