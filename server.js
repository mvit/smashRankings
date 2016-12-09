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
var IDs = [];
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
var players = []

function parseParticipants(list) {
  console.log('parsing participants')
  for (i = 0; i < list.length; i++) {
    var player = {}
    player.name = list[i].participant.name
    player.id = list[i].participant.id
    player.skill = [25.0, 25.0/3.0]
    player.rank = list[i].participant.final_rank
    players.push(player);
  }
  trueskill.AdjustPlayers(players)
  console.log(players)
}

function buildParticipants(response) {
  var str = '';
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
    //console.log(str)
    parseParticipants(JSON.parse(str));
  });
}

function getParticipants(tournament) {
  var options = {
    host: challongeHost,
    path: '/v1/tournaments/' + tournament + '/participants.json?api_key=' + APIKey,
    port: '443',
    method: 'GET'
  };
  https.request(options, buildParticipants).end();
}

function parseTournaments(tournaments)
{
  //console.log(tournaments);
  for (var item = 0; item < tournaments.length; item++)
  {
    console.log(tournaments[item].tournament.game_name);
    if (tournaments[item].tournament.game_name == 'Super Smash Bros. Melee')
    {
      IDs.push(tournaments[item].tournament.id);
    }
  }
  console.log("IDs = " + IDs);
  for (var i = 0; i < IDs.length; i++)
  {
    getParticipants(IDs[i]);
  }
}

function getParticipants(num)
{
  console.log(num);
}

function buildTournaments(response) {
  var str = '';
  console.log('building tournament')
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
    //console.log(str)
    parseTournaments(JSON.parse(str));
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
getTournaments();
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
