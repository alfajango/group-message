
/**
 * Module dependencies.
 */
var sys = require('sys');
var express = require('express');

var app = express();

var querystring = require('querystring'),
    http = require('https');

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('port', process.env.PORT || 3000);
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

var recipients = function(from) {
  var possibleRecip = 10,
      allRecip = [],
      fromInitials = null;

  for (var i = 0; i < possibleRecip; i++) {
    var thisRecip = "RECIPIENT_" + i,
        recip = process.env[thisRecip];

    if (recip) {
      if (recip === from) {
        fromInitials = process.env["RECIPIENT_" + i + "_INITIALS"];
      } else {
        allRecip.push(recip);
      }
    }
  }

  return fromInitials ? {fromInitials: fromInitials, recipients: allRecip} : false;
};

var postSmsData = function(to, body) {
  return querystring.stringify({
    From: process.env.TWILIO_OUTGOING_NUMBER,
    Body: body,
    To: to
  });
};

var postSmsOptions = function(data) {
  return {
    host: 'api.twilio.com',
    port: '443',
    path: '/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/SMS/Messages.json',
    method: 'POST',
    auth: process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN,
    body: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length
    }
  }
}

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

app.post('/incoming', function(req, res) {
  var from = req.body.From,
      setupRecip = recipients(from),
      numSent = 0;

  if (setupRecip) {
    var recip = setupRecip.recipients,
        initials = setupRecip.fromInitials,
        message = initials + ': ' + req.body.Body;

    sys.log('From: ' + from + ', To: ' + recip.join() + ', Message: ' + message);

    for (var i = 0; i < recip.length; i++) {
      var smsData = postSmsData(recip[i], message),
          smsOptions = postSmsOptions(smsData),
          sendSms = http.request(smsOptions, function(res) {
            res.on('data', function (chunk) {
              console.log('BODY: ' + chunk);
            });
            sys.log('Sent: ' + res.statusCode);
          });

      sendSms.write(smsData)

      sendSms.on('error', function(e) {
        console.log('problem with request: ' + e.message);
      });

      sendSms.end();
    }
  }

  res.send('<?xml version="1.0" encoding="UTF-8" ?>\n<Response></Response>', {'Content-Type':'text/xml'}, 200);

});


// Only listen on $ node app.js

if (!module.parent) {
  app.listen(process.env.PORT, function() {
    console.log("Express server listening on port %d", process.env.PORT);
  });
}
