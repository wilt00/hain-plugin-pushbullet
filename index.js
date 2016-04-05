/*jshint esversion: 6 */

(function(){
	'use strict';

	module.exports = (pluginContext) => {

		const toast = pluginContext.toast;
		const logger = pluginContext.logger;
		const app = pluginContext.app;
		const shell = pluginContext.shell;
		const prefs = pluginContext.preferences;

		const https = require("https");

		var token = null;
		var isValidToken = false;

		function testToken(){
			if(token === null){
				isValidToken = false;
				return;
			}

			const options = {
				"method": "GET",
				"hostname": "api.pushbullet.com",
				"path": "/v2/users/me",
				"headers": {
					"access-token": token
				}
			};

			https.get(options, (response) => {
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
						isValidToken = true;
					} else {
						logger.log("Pushbullet: Bad token");
					}
				});
			}).on('error', (e) => {
				logger.log("Pushbullet: unable to connect");
				logger.log(e.message);
			});
		}

		function onPrefUpdate(pref) {
			token = prefs.get('token');
			testToken();
		}

		function startup() {
			token = prefs.get("token");
			testToken();
			//logger.log("Pushbullet: token is " + token);
			prefs.on('update', onPrefUpdate);
		}

		function search(query, res) {

			if(!isValidToken){
				res.add({
					id: "noToken",
					title: "Your pushbullet access token is not set or is not correct.",
					desc: "Please add your token in the plugin preferences"
				});
				res.add({
					id: "noTokenHelp",
					title: "Your access token can be generated at:",
					desc: "https://www.pushbullet.com/#settings/account"
				});
				return;
			}

			const query_trim = query.trim();
			var query_split = query_trim.split(" ");

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
			if(!isValidToken){
				logger.log("Something is wrong! No valid token.");
				return;
			}

			const options = {
				"method": "GET",
				"hostname": "api.pushbullet.com",
				"path": "/v2/pushes",
				"headers": {
					"access-token": token
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
						toast.enqueue("Something is wrong with your access token! Please reset it in the plugin preferences");
						isValidToken = false;
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
			// How important is it really that id's are unique? Considering changing this.
			if((id.split(" "))[0] === "push"){
				shell.openExternal(payload.url);
			}
		}

		return { startup, search, execute };
	};
})();