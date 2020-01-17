
statust = document.getElementById("statusspan");

zone1 = document.getElementById("zone1");

var connection;
var checkStatus = 0;

statust.innerHTML = "PreOpen";
// if user is running mozilla then use it's built-in WebSocket
window.WebSocket = window.WebSocket || window.MozWebSocket;
if (window.WebSocket === undefined) {
	content.html($('<p>',{ text:'Sorry, but your browser doesn\'t support WebSocket.'}));
	exit;
	}
else {
	window.addEventListener("load", start, false);
	statust.innerHTML = "Listener Added";
}

function start() {
	statust.innerHTML = "Connecting";
	connection = new WebSocket('ws://192.168.1.94:1338');
	connection.onopen = function(evt) { onOpen(evt); };
	connection.onerror = function(evt) { onError(evt); };
	connection.onmessage = function(evt) { onMessage(evt); };
	if (checkStatus == 0) {
		checkStatus = setInterval(checkTimeout, 3000);
	}
}


 function checkTimeout() {
    if (connection.readyState !== 1) {
		statust.innerHTML = "Connection Timeout";
		console.log('Connection Timeout');
		start();
		console.log('Restarted');
    }
}

function onOpen(evt) {
	statust.innerHTML = "Connected";
};

function onError(evt) {
	statust.innerHTML = "Connection Error";
};

function onMessage(message) {
	try {
		var json = JSON.parse(message.data);
	} catch (e) {
		console.log('Invalid JSON: ', message.data);
		statust.innerHTML = "Invalid Message";
		return;
	}
	if (json.on == true) {
		statust.innerHTML = "System On";
	}
	else {
		statust.innerHTML = "System Off";
	}
};

function clickFun(command){
	if (connection.readyState == 1) {
		connection.send(command);
	}
	else {
		console.log('Got Click, connection not ready');
		statust.innerHTML = 'Connection not ready';
	}
};
