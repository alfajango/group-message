
/**
 * Module dependencies.
 */
var sys = require('sys');
var express = require('express');

var app = express();

var TwilioClient = require('twilio').Client,
    Twiml = require('twilio').Twiml,
    twilClient = new TwilioClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, 'aj-group-message.herokuapp.com', {
      "express" : app,
      "port" : process.env.PORT
    });

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
      allRecip = [];

  for (var i = 0; i < possibleRecip; i++) {
    var thisRecip = "RECIPIENT_" + i,
        recip = process.env[thisRecip];

    if (recip) {
      allRecip.push(recip);
    }
  }

  sys.log('allRecip: ' + allRecip);
  return allRecip;
}

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

//app.post('/incoming', function(req, res) {
  //sys.log('incoming:');
  //console.log(req.Body);
  //var message = req.Body;
  //var from = req.From;

  //sys.log('From: ' + from + ', Message: ' + message);
  //var recip = recipients(from);
  ////var twiml = '<?xml version="1.0" encoding="UTF-8" ?>\n<Response>\n<Sms>Thanks for your text, we\'ll be in touch.</Sms>\n</Response>';
  //res.send(null, {'Content-Type':'text/xml'}, 200);

  //var phone = twilClient.getPhoneNumber(process.env.TWILIO_OUTGOING_NUMBER);
  //var numSent = 0;
  //phone.setup(function() {
    //for (var i = 0; i < recip.length; i++) {
      //phone.sendSms(recip[i], message, null, function(sms) {
        //sms.on('processed', function(reqParams, response) {
          //sys.log('Message processed:');
          //sys.log(reqParams);
          //numSent += 1;
          //if (numSent == recip.length) { process.exit(0); }
        //});
      //});
    //}
  //});

//});


var phone = twilClient.getPhoneNumber(process.env.TWILIO_OUTGOING_NUMBER);
var numSent = 0;
phone.setup(function() {
  phone.on('incomingSms', function(reqParams, res) {
    sys.log('incoming:');
    console.log(reqParams.Body);
    var message = reqParams.Body;
    var from = reqParams.From;

    sys.log('From: ' + from + ', Message: ' + message);
    var recip = recipients(from);
    for (var i = 0; i < recip.length; i++) {
      phone.sendSms(recip[i], message, null, function(sms) {
        sms.on('processed', function(reqParams, response) {
          sys.log('Message processed:');
          sys.log(reqParams);
          numSent += 1;
          if (numSent == recip.length) { process.exit(0); }
        });
      });
    }
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(app.get('port'), function() {
    console.log("Express server listening on port %d", app.get('port'));
  });
}
