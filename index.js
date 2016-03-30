/*jshint esversion: 6 */

(function(){
	'use strict';

	module.exports = (pluginContext) => {

		const toast = pluginContext.toast;
		const logger = pluginContext.logger;
		const app = pluginContext.app;
		const shell = pluginContext.shell;

		const https = require("https");
		const fs = require("fs");
		const path = require("path");

		const settingsFileName = path.resolve(__dirname, "settings.json");	
		// Required because ./ gives inconsistent results.
		
		var settings;

		function startup() {
			fs.access(settingsFileName, fs.F_OK, (err) => {
				if(err){
					logger.log("Pushbullet: Creating settings file at " + settingsFileName);
					settings = {};
					saveSettings({
						exists: true,
						hasValidToken: false
					}, () => {
						settings = require(settingsFileName);
						logger.log(settings);
						logger.log("Pushbullet settings file exists: " + settings.exists);
						logger.log("Pushbullet token set: " + settings.hasValidToken);
					});
				}else{
					settings = require(settingsFileName);
					logger.log("Pushbullet settings file: " + settingsFileName);
					logger.log("Pushbullet settings file exists: " + settings.exists);
					logger.log("Pushbullet token set: " + settings.hasValidToken);
				}
			});
		}

		//var pushText;
		//var pushUrl;

		function search(query, res) {

			const query_trim = query.trim();
			var query_split = query_trim.split(" ");

			if (query_split[0].toLowerCase() === 'settoken') {
				res.add({
					id: "setToken",
					payload: query_split[1],
					title: "Please enter your 34 character access token",
					desc: "Press enter to save"
				});
				res.add({
					id: "noTokenHelp",
					title: "Your access token can be generated at:",
					desc: "https://www.pushbullet.com/#settings/account"
				});
				return;
			}

			if(!settings.hasValidToken){
				res.add({
					id: "noToken",
					title: "Your pushbullet access token is not set.",
					desc: "Please execute '/pushbullet settoken [your token]"
				});
				res.add({
					id: "noTokenHelp",
					title: "Your access token can be generated at:",
					desc: "https://www.pushbullet.com/#settings/account"
				});
				return;
			}

			/*
			if (query_split[0].toLowerCase() === 'push'){
				res.add({
					id: "setPushText",
					payload: query_trim.substring(query_split[0].length + 1),
					title: ((pushText === undefined) ? "Enter the text of your push here" : "Sending push with text: " + pushText),
					desc: "Type the text you would like to push, select this item, and press enter."
				});
				res.add({
					id: "setPushUrl",
					payload: query_split[1],
					title: ((pushUrl === undefined) ? "Enter your push URL here" : "Sending push with url: " + pushUrl),
					desc: "Type the URL you would like to push, select this item, and press enter."
				});
				res.add({
					id: "sendPush",
					title: "Execute this item to send",
					desc: "Text: \"" + pushText + "\", URL: " + pushUrl
				});
				return;
			}
			*/

	    	res.add({
	    		id: "helpText",
	    		title: "To send a push, execute /pushbullet push [url] [description]",
	    		desc: "Your recently sent pushes will be loaded below"
	    	});

	    	loadPushes( (pushes) => {
	    		for(var i = 0; i < pushes.length; i++){
	    		var titleString = null;
	    		var descString = null;
	    		if(pushes[i].hasOwnProperty("title")){
	    			titleString = pushes[i].title;
	    			descString = pushes[i].url;
	    		}else if(pushes[i].hasOwnProperty("body")){
	    			titleString = pushes[i].body;
	    			descString = pushes[i].url;
	    		}else{
	    			titleString = pushes[i].url;
	    		}
	    		res.add({
	    			id: "push " + pushes[i].iden,
	    			payload: pushes[i],
	    			title:titleString,
	    			desc:descString
	    		});
	    	}
	    	});

/*
	    	if (query_trim.length === 0) {
	      		return;
	    	}
*/
		}

		function loadPushes(callback){
			if(!settings.hasValidToken){
				logger.log("Something is wrong! No valid token.");
				return;
			}

			const options = {
				"method": "GET",
				"hostname": "api.pushbullet.com",
				"path": "/v2/pushes",
				"headers": {
					"access-token": settings.token
				}
			};

			https.get(options, (response) => {
				var body = '';
				response.on('data', (d) => {
					body += d;
				});
				response.on('end', () => {
					//logger.log(body);
					const bodyObject = JSON.parse(body);
					const pushes = bodyObject.pushes;
					//const cursor = bodyObject.cursor;
					if(bodyObject.error_code === "invalid_access_token"){
						toast.enqueue("Something is wrong with your access token! Please reset it with /pushbullet settoken [token]");
						saveSettings({
							"hasValidToken": false
						});
						return;
					}
					callback(pushes);
				});
			}).on('error', (e) => {
				toast.enqueue("Unable to connect to Pushbullet. Please try again later.");
				logger.log(e.message);
			});
		}

		function execute(id, payload){
			if(id === 'setToken'){
				//const token = "'Access-Token: " + payload + "'";
				//logger.log(token);
				setToken(payload);
				return;
			}
			if(id === "setPushText"){
				pushText = payload;
				return;
			}
			if(id === "setPushUrl"){
				pushUrl = payload;
				return;
			}
			if(id === "sendPush"){
				sendPush();
				return;
			}
			// How important is it really that id's are unique? Considering changing this.
			if((id.split(" "))[0] === "push"){
				shell.openExternal(payload.url);
			}
		}

		function setToken(token){
			toast.enqueue("Validating token...");
			const options = {
				"method": "GET",
				"hostname": "api.pushbullet.com",
				"path": "/v2/users/me",
				"headers": {
					"access-token": token
				}
			};

			https.get(options, (response) => {
				toast.enqueue("Receiving response...");

				logger.log('statusCode: ' + response.statusCode);
				logger.log('headers: ' + response.headers);

				var body = '';

				response.on('data', (d) => {
					body += d;
				});

				response.on('end', () => {
					logger.log(body);
					const bodyJson = JSON.parse(body);
					if(bodyJson.active === true){
						toast.enqueue("Token validated successfully! Saving token...");
						saveSettings({
							"token": token,
							"hasValidToken": true
						});
					} else {
						toast.enqueue("Pushbullet's server didn't like your token. Please try again.");
					}
				});
			}).on('error', (e) => {
				toast.enqueue("Unable to connect to Pushbullet. Please try again later.");
				logger.log(e.message);
			});

			app.setInput(""); 
		}

		function saveSettings(object, callback){
			var newSettings = settings;

			for (var property in object){
				logger.log(property);
				newSettings[property] = object[property];
			}

			logger.log(newSettings);

			try{
				const newSettingsString = JSON.stringify(newSettings);

				fs.writeFile(settingsFileName, newSettingsString, function(err) {
					if(err){
						logger.log(err);
					} else {
						logger.log("Settings saved to " + settingsFileName);
					}
					toast.enqueue("Pushbullet settings saved!");

					if(callback !== undefined){
						callback();
					}
				});	
			}catch(e){
				logger.log(e.message);
			}	
		}

		/*
		function hashString(string){
			// Thanks http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/ !
			var hash = 0;
			if(string.length === 0) return hash;
			for(var i = 0; i < string.length; i++){
				chr = string.charCodeAt(i);
				hash = ((hash << 5)) - hash + chr; 
				// hash << 5  ---  shift hash 5 bits to the left
				hash = hash & hash; // Convert to 32 bit integer
			}
			return hash;
		}

		function sendPush(){
			if(pushUrl === undefined && pushText === undefined){
				toast.enqueue("Please enter either a URL or some text before sending this push");
				return;
			}

			var push = {
				guid: Date.now()
			};

			if(pushUrl === undefined){
				push.type = "note";
				push.guid *= hashString(pushText);
				// Requires a unique guid
			}else{
				push.type = "link";
				push.url = pushUrl;
				push.guid *= hashString(pushUrl);
			}

			if(pushText !== undefined){
				push.title = pushText;
			}

			pushJson = Json.stringify(push);

			const options = {
				"method": "POST",
				"hostname": "api.pushbullet.com",
				"path": "/v2/pushes",
				"headers": {
					"access-token": token,
					"content-type": "application/json"
				},
			};

			var request = https.request(options, (res) => {
				var body = "";
				res.on("data", (d) => {
					body += d;
				});
				res.on("end", () => {
					logger.log(body);
				});
			}).on('error', (e) => {
				toast.enqueue("Unable to connect to Pushbullet. Please try again later.");
				logger.log(e.message);
			});
			request.write(pushJson);
			request.end();

			toast.enqueue("Push sent successfully!");
			app.setInput("");
		}
		*/

		return { startup, search, execute };
	};
})();