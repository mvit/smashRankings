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
function doTrueSkill(row) {
  var stmt = db.prepare("UPDATE players SET score=?, sigscore=?, win=?, loss=? WHERE id=?")
  db.serialize(function() {
    var p1 = {}
    var p2 = {}

    db.get("SELECT * FROM players WHERE id = ?", row.p1_id, function (err, row1) {
      db.get("SELECT * FROM players WHERE id = ?", row.p2_id, function (err, row2) {
        p1 = {}
        p1_wins = row1.win;
        p1_loss = row1.loss;
        p1.skill = [row1.score , row1.sigscore]
        
        p2 = {}
        p2_wins = row2.win;
        p2_loss = row2.loss;
        p2.skill = [row2.score , row2.sigscore]
        
        if (row.p2_score > row.p1_score) {
          p1.rank = 2;
          p2.rank = 1;
          p1_loss++;
          p2_wins++;
        }
        else {
          p1.rank = 1;
          p2.rank = 2;
          p2_loss++;
          p1_wins++;
        }
        
        trueskill.AdjustPlayers([p1,p2])
        stmt.run(p1.skill[0], p1.skill[1],p1_wins,p1_loss,row.p1_id)
        stmt.run(p2.skill[0], p2.skill[1],p2_wins,p2_loss,row.p2_id)
        stmt.finalize()
        loadNextMatch();
      })
    })
  })
}

var cnt = 0;
var matchlist;
function loadNextMatch(list) {
  if (cnt < matchlist.length) {
    doTrueSkill(matchlist[cnt]);
    cnt++;
  }
}

function loadMatches() {
  db.all("SELECT * FROM matches", 
  function(err, rows) {
    matchlist = rows;
    loadNextMatch();
  })
}
function parseMatches(list) {
  //console.log(players)
  for (i = 0; i < list.length; i++) {
    scores = list[i].match.scores_csv.split('-')
    var p1 = players[list[i].match.player1_id]
    var p2 = players[list[i].match.player2_id]
    db.run("INSERT INTO matches VALUES (?, ?, ?, ?, ?, ?)",list[i].match.id, p1, p2, scores[0], scores[1], IDs[IDs.length-1]);
  }
  //now do trueskill stuff
  loadMatches();
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
  console.log(IDs.length)
  console.log(IDs[0])
  var options = {
    host: challongeHost,
    path: '/v1/tournaments/' + IDs[IDs.length - 1] + '/matches.json?api_key=' + APIKey,
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
    path: '/v1/tournaments/' + IDs[IDs.length - 1] + '/participants.json?api_key=' + APIKey,
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
