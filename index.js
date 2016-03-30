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

	    	res.add({
	    		id: "loadingText",
	    		title: "Your pushes are now loading below",
	    		desc: "Please wait..."
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
	    		res.remove("loadingText");
	    	}
	    	});
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
					const bodyObject = JSON.parse(body);
					const pushes = bodyObject.pushes;
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

		return { startup, search, execute };
	};
})();