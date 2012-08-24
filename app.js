
/**
 * Module dependencies.
 */
var sys = require('sys');
var express = require('express');

var app = express();

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

app.post('/incoming', function(req, res) {
  var message = req.body.Body;
  var from = req.body.From;

  sys.log('From: ' + from + ', Message: ' + message);
  recipients(from);
  //var twiml = '<?xml version="1.0" encoding="UTF-8" ?>\n<Response>\n<Sms>Thanks for your text, we\'ll be in touch.</Sms>\n</Response>';
  res.send(null, {'Content-Type':'text/xml'}, 200);
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(app.get('port'), function() {
    console.log("Express server listening on port %d", app.get('port'));
  });
}
