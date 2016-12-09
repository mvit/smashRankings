var https = require('https')
  , fs   = require('fs')
  , url  = require('url')
  , path = require('path')
  , http = require('http')
  , trueskill = require('trueskill')
  , later = require('later')
  , port = 8080
  
var challongeHost = 'api.challonge.com'
var APIKey = '2aXYxGwZxmCd16gzgwBEja8QFtR0xd4bR7yCykg8'
var rankings = [{"tag" : "ZettaVolt", "wins": "9999", "losses": "0", "score": "1337", "last":"Dec. 7, 2016"},{"tag" : "Tessa", "wins": "0", "losses": "9999", "score": "last lmao", "last":"Dec. 7, 2016"}]

var server = http.createServer (function (req, res) {
  var uri = url.parse(req.url)

  switch( uri.pathname ) {
    case '/':
      sendFile(res, 'index.html')
      break
    case '/index.html':
      sendFile(res, 'index.html')
      break
    case '/style.css':
      sendFile(res, 'style.css')
      break
    case '/player.html':
      sendFile(res, 'player.html')
      break
    case '/rankings':
      res.end(JSON.stringify(rankings))
      break
    default:
      res.end('404 not found')
  }
})

function buildTournaments(response) {
  var str = '';
  console.log('building tournament')
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
    console.log(str)
//    console.log(JSON.parse(str))
  });
}

function getTournaments() {
  var options = {
    host: challongeHost,
    path: '/v1/tournaments.json?api_key=' + APIKey,
    port: '443',
    method: 'GET'
  };
  https.request(options, buildTournaments).end();
}

//get all tournaments
getTournaments()
var textSched = later.parse.text('at 12:00am every sunday');
var timer = later.setInterval(getTournaments, textSched);
server.listen(process.env.PORT || port);
console.log('listening on 8080')

// subroutines

function sendFile(res, filename) {

  fs.readFile(filename, function(error, content) {
    res.writeHead(200, {'Content-type': 'text/html'})
    res.end(content, 'utf-8')
  })

}
