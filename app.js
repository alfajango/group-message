
/**
 * Module dependencies.
 */
var sys = require('sys');
var express = require('express');

var app = express();

var querystring = require('querystring'),
    http = require('follow-redirects').https,
    url = require('url');

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

var recipients = function(from, toSelf) {
  var possibleRecip = 10,
      allRecip = [],
      fromInitials = null;

  for (var i = 0; i < possibleRecip; i++) {
    var thisRecip = "RECIPIENT_" + i,
        recip = process.env[thisRecip];

    if (recip) {
      if (recip === from) {
        fromInitials = process.env["RECIPIENT_" + i + "_INITIALS"];
        if (toSelf) {
          allRecip.push(from);
        }
      } else {
        if (!toSelf) {
          allRecip.push(recip);
        }
      }
    }
  }

  return fromInitials ? {fromInitials: fromInitials, recipients: allRecip} : false;
};

var postSmsData = function(to, body, mediaUrl) {
  var data = {
    From: process.env.TWILIO_OUTGOING_NUMBER,
    Body: body,
    To: to
  };

  if (mediaUrl) {
    data.MediaUrl = mediaUrl;
  }

  return querystring.stringify(data);
};

var postSmsOptions = function(data) {
  return {
    host: 'api.twilio.com',
    port: '443',
    path: '/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json',
    method: 'POST',
    auth: process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN,
    body: data,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length
    }
  }
}

var sendError = function(from, error) {
  var smsData = postSmsData(from, 'Message not sent. ' + error),
      smsOptions = postSmsOptions(smsData),
      sendSms = http.request(smsOptions, function(res) {
        var resBody = '';
        res.on('data', function (chunk) {
          resBody += chunk;
        });
        res.on('end', function() {
          sys.log('Response body: ' + resBody);
          if (res.statusCode.toString()[0] === "2") {
            sys.log('Error message sent.');
          } else {
            sys.log('Error message not sent!');
          }
        });
      });

  sendSms.write(smsData)

  sendSms.on('error', function(e) {
    sys.log('problem with request: ' + e.message);
  });

  sendSms.end();
};

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

app.post('/incoming', function(req, res) {
  var from = req.body.From,
      // Allow to send test messages to self by prepending message with ~
      toSelf = req.body.Body && req.body.Body.match(/^(\s+)?~/),
      setupRecip = recipients(from, toSelf),
      numSent = 0;

  sys.log('Received: ' + JSON.stringify(req.body));

  if (setupRecip) {
    var recip = setupRecip.recipients,
        initials = setupRecip.fromInitials,
        message = initials + (toSelf ? ' (test)' : '') + ': ' + req.body.Body,
        numMedia = req.body.NumMedia && parseInt(req.body.NumMedia),
        mediaUrl = req.body.MediaUrl0,
        messages = mediaUrl ? [message] : message.match(/.{1,160}/g), // split message into 160-character chunks if plain SMS text (MMS can support much larger messages)
        errorMessageSent = false;

    // Replace Twilio media URL, which redirects, to our own proxy, which follows redirect and renders image
    if (mediaUrl) {
      mediaUrl = "https://aj-group-message.herokuapp.com/proxy?image_url=" + escape(mediaUrl);
    }

    sys.log('From: ' + from + ', To: ' + recip.join() + ', Num Media: ' + numMedia + ', Media URL: ' + mediaUrl + ', Message: ' + message);

    for (var n = 0; n < messages.length; n++) {
      for (var i = 0; i < recip.length; i++) {
        if (mediaUrl && n === 0) {
          var smsData = postSmsData(recip[i], messages[n], mediaUrl);
        } else {
          var smsData = postSmsData(recip[i], messages[n]);
        }
        sys.log('Sending: ' + smsData);
        var smsOptions = postSmsOptions(smsData),
            sendSms = http.request(smsOptions, function(res) {
              var resBody = '';
              res.on('data', function (chunk) {
                resBody += chunk;
              });
              res.on('end', function() {
                sys.log('Response body: ' + resBody);
                sys.log('Send status: ' + res.statusCode);
                if (res.statusCode.toString()[0] === "2") {
                  sys.log('Sent.');
                } else {
                  sys.log('Not sent!');
                  if (!errorMessageSent) {
                    var responseJson = JSON.parse(resBody);
                    errorMessageSent = true;
                    sendError(from, [responseJson.message, 'More info:', responseJson.more_info].join(' '));
                  }
                }
              });
            });

        sendSms.write(smsData)

        sendSms.on('error', function(e) {
          sys.log('problem with request: ' + e.message);
          sendError(from, e.message);
        });

        sendSms.end();
      }
    }
  }

  res.send('<?xml version="1.0" encoding="UTF-8" ?>\n<Response></Response>', {'Content-Type':'text/xml'}, 200);

});

app.get('/proxy', function(req, res) {
  var image_url = unescape(req.query.image_url);
  sys.puts("Starting proxy: " + image_url);

  var image_host_name = url.parse(image_url).hostname;
  var pathname = url.parse(image_url).pathname;

  var image_get_request = http.request({"method": 'GET', "path": pathname, "host": image_host_name, "port": 443}, function(proxy_response) {
    var current_byte_index = 0;
    var response_content_length = parseInt(proxy_response.headers["content-length"]);
    var response_content_type = proxy_response.headers["content-type"];
    var response_body = new Buffer(response_content_length);
    sys.puts("Image proxy response: " + JSON.stringify(proxy_response.headers) + ", Content Length: " + response_content_length + ", Content Type: " + response_content_type);

    proxy_response.setEncoding('binary');
    proxy_response.on('data', function(chunk){
      response_body.write(chunk, current_byte_index, "binary");
      current_byte_index += chunk.length;
    });
    proxy_response.on('end', function(){
      res.contentType(response_content_type);
      res.send(response_body);
    });
  });
  image_get_request.end();
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(process.env.PORT, function() {
    console.log("Express server listening on port %d", process.env.PORT);
  });
}
