var https = require('https')
  , fs   = require('fs')
  , url  = require('url')
  , path = require('path')
  , http = require('http')
  , trueskill = require('trueskill')
  , later = require('later')
  , port = 8080
  , sqlite3 = require('sqlite3').verbose()
  
var challongeHost = 'api.challonge.com'
var APIKey = '2aXYxGwZxmCd16gzgwBEja8QFtR0xd4bR7yCykg8'
var IDs = [];
var players = []
var tags=[]
var cnt=0;

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
      sendRankings(res)
      break
    default:
      res.end('404 not found')
  }
})

function parseParticipants(list) {
  //console.log('parsing participants')
  for (i = 0; i < list.length; i++) {
    if (tags.indexOf(list[i].participant.name) == -1) {
      db.run("INSERT INTO players VALUES (?, ?, ?, ?, ?)",cnt, list[i].participant.name, 100, 0, 9999);
      cnt++;
      tags.push(list[i].participant.name)
    }
  }
  //trueskill.AdjustPlayers(players)
  //console.log(players)
}

function buildParticipants(response) {
  var str = '';
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
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

function parseTournaments(tournaments){
  //console.log(tournaments);
  for (var item = 0; item < tournaments.length; item++)
  {
    //console.log(tournaments[item].tournament.game_name);
    if (tournaments[item].tournament.game_name == 'Super Smash Bros. Melee')
    {
      if (tournaments[item].tournament.name.toLowerCase().indexOf("singles") != -1)
      {
        IDs.push(tournaments[item].tournament.id);
      }
    }
  }
  //console.log("IDs = " + IDs);
  for (var i = 0; i < IDs.length; i++)
  {
    getParticipants(IDs[i]);
  }
}

function sendRankings(res) {
  db.all("SELECT * FROM players ORDER BY score", function(err, rows) {
    res.end(JSON.stringify(rows))
  })
}

function buildTournaments(response) {
  var str = '';
  //console.log('building tournament')
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

//Build the database
var file = "ranks.db"
var exists = fs.existsSync(file)

if (!exists) {
  console.log("Creating database")
  fs.openSync(file, "w")
}
var db = new sqlite3.Database(file);

if (!exists) {
  db.serialize(function() {
    console.log("I'm in me mum's car")
      db.run("CREATE TABLE players (\
      id INTEGER NOT NULL, \
      tag TEXT(50) NOT NULL, \
      win INTEGER(4), \
      loss INTEGER(4),\
      score INTEGER(4),\
      PRIMARY KEY(id))")

      db.run("CREATE TABLE matches(\
        id INT NOT NULL, \
        p1_id TEXT(50) NOT NULL, \
        p2_id int(4), \
        p1_score INT(4),\
        p2_score INT(4),\
        t_id int(4),\
        PRIMARY KEY(id))")
  })
  getTournaments();
  
}

//get all tournaments
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
