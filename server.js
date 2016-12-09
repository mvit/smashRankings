var http = require('http')
  , fs   = require('fs')
  , url  = require('url')
  , path = require('path')
  , qs = require('qs')
  , XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest
  , port = 8080
  


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

function makeGet(url) {
  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    handleRes(req);
  }
  req.open('GET', url);
  req.send;
}

function handleRes(req) {
  if( req.readyState !== XMLHttpRequest.DONE )
    return;

  if(req.status === 200)
    getTournaments( JSON.parse(req.responseText) );
}

function getTournaments(tournaments) {
  //melee
  console.log(tournaments);
}

//get all tournaments
makeGet('http://api.challonge.com/v1/tournaments.json?api_key=2aXYxGwZxmCd16gzgwBEja8QFtR0xd4bR7yCykg8');

server.listen(process.env.PORT || port);
console.log('listening on 8080')

// subroutines

function sendFile(res, filename) {

  fs.readFile(filename, function(error, content) {
    res.writeHead(200, {'Content-type': 'text/html'})
    res.end(content, 'utf-8')
  })

}
