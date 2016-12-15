var https = require('https')
, request = require('then-request')
, fs   = require('fs')
, url  = require('url')
, path = require('path')
, http = require('http')
, trueskill = require('trueskill')
, later = require('later')
, uuidV4 = require('uuid/v4')
, sqlite3 = require('sqlite3').verbose()

var challongeHost = 'api.challonge.com'
, APIKey = '2aXYxGwZxmCd16gzgwBEja8QFtR0xd4bR7yCykg8'
, port = 8080
, file = "ranks.db"

var IDs = []
, players = {}
  
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
    case '/players':
      sendPlayer(res, req)
      break
    case '/rankings':
      sendRankings(res)
      break
    default:
      res.end('404 not found')
  }
})

//SubRoutines

function doTrueskill() {
  db.each("SELECT * FROM matches", function(err, row) {
    //console.log(row)
    db.serialize( function() {
      //console.log(row.p1_id)
      var p1 = {};
      var p2 = {};

      p1.rank = 1;
      p2.rank = 2;

      if (row.p2_score > row.p1_score) {
        p1.rank = 2;
        p2.rank = 1;
      }
      
      db.serialize(function() {
        db.get("SELECT * FROM players WHERE id = ?", row.p1_id, function (err, row1) {
          p1.skill = [row1.score, row1.sigscore]
          db.get("SELECT * FROM players WHERE id = ?", row.p2_id, function (err, row2) {
            p2.skill = [row2.score, row2.sigscore]
            trueskill.AdjustPlayers([p1,p2])
            db.serialize(function() {
              db.run("UPDATE players set score=?, sigscore=? where id=?", p1.skill[0], p1.skill[1], row.p1_id)
              db.run("UPDATE players set score=?, sigscore=? where id=?", p2.skill[0], p2.skill[1], row.p2_id)
            })
          })
        })
      })

    })
  })
}

function parseMatches(list) {
  //console.log(players)
  for (i = 0; i < list.length; i++) {
    scores = list[i].match.scores_csv.split('-')
    var p1 = players[list[i].match.player1_id]
    var p2 = players[list[i].match.player2_id]
    db.run("INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?)",list[i].match.id, p1, p2, scores[0], scores[1], IDs[0]);
  }
  //now do trueskill stuff
  doTrueskill();
} 

function buildMatches(response) {
  var str = '';  
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
    parseMatches(JSON.parse(str));
  });
}

function getMatches() {
  var options = {
    host: challongeHost,
    path: '/v1/tournaments/' + IDs[0] + '/matches.json?api_key=' + APIKey,
    port: '443',
    method: 'GET'
  };
  https.get(options, buildMatches)
}

function parseParticipants(list) {
  players = {}
  for (i = 0; i < list.length; i++) {
    var id = uuidV4();
    players[list[i].participant.id] = id;
    //console.log(list[i].participant.id + ',' + id)
    db.run("INSERT INTO players VALUES (?, ?, ?, ?, ?, ?)", id, list[i].participant.name, 0, 0, 25.0, 25.0/3.0);
  }
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

function getParticipants() {
  var options = {
    host: challongeHost,
    path: '/v1/tournaments/' + IDs[0] + '/participants.json?api_key=' + APIKey,
    port: '443',
    method: 'GET'
  };
  https.get(options, buildParticipants).end();
}

function parseTournaments(tournaments){
  for (var item = 0; item < tournaments.length; item++)
  {
    if (tournaments[item].tournament.game_name == 'Super Smash Bros. Melee')
    {
      if (tournaments[item].tournament.name.toLowerCase().indexOf("singles") != -1)
      {
        IDs.push(tournaments[item].tournament.id);
      }
    }
  }
  getParticipants();
  getMatches();
}

function buildTournaments(response) {
  var str = '';
  response.on('data', function (chunk) {
    str += chunk;
  });
  response.on('end', function(chunk) {
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
  https.get(options, buildTournaments);
}

function sendPlayer(res, req) {
  var uri = url.parse(req.url)
  queryresults = uri.query.split("=")
  playerid=queryresults[1]
  db.get('SELECT * FROM players WHERE id=?', playerid, function(err, row) {
      console.log(row)
      console.log(JSON.stringify(row))
      res.end(JSON.stringify(row))
  })
}

function sendRankings(res) {
  db.all("SELECT * FROM players ORDER BY score DESC", function(err, rows) {
    res.end(JSON.stringify(rows))
  })
}

function sendMatches(res) {
  var uri = url.parse(req.url)
  queryresults = uri.query.split("=")
  playerid=queryresults[1]
  db.all("SELECT * FROM matches WHERE p1_id = ?", playerid, function(err, rows) {
    res.end(JSON.stringify(rows))
  })
}

function sendFile(res, filename) {
  fs.readFile(filename, function(error, content) {
    res.writeHead(200, {'Content-type': 'text/html'})
    res.end(content, 'utf-8')
  })
}

//Build the database
var exists = fs.existsSync(file)

if (!exists) {
  console.log("Creating database")
  fs.openSync(file, "w")
}

var db = new sqlite3.Database(file);

if (!exists) {
  db.serialize(function() {
    db.run("CREATE TABLE players (\
      id TEXT NOT NULL, \
      tag TEXT(50) NOT NULL, \
      win INTEGER(4), \
      loss INTEGER(4),\
      score REAL,\
      sigscore REAL,\
      PRIMARY KEY(id))")

      db.run("CREATE TABLE matches(\
        id TEXT NOT NULL, \
        p1_id TEXT NOT NULL, \
        p2_id TEXT NOT NULL, \
        p1_score INT(4),\
        p2_score INT(4),\
        t_id int(4),\
        PRIMARY KEY(id))")
      })

      //get all tournaments
      getTournaments();

    }

    //Schedule next server stuff
    var textSched = later.parse.text('at 12:00am every sunday');
    var timer = later.setInterval(getTournaments, textSched);
    server.listen(process.env.PORT || port);
    console.log('listening on 8080')
