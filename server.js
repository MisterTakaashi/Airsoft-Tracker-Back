var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(80);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

let sessions = [];

io.on('connection', function (socket) {
    console.log("Utilisateur connecté !");

    socket.on('session create', () => {
        console.log("Demande de creation de session");

        let id = makeid()
        
        let session = {
            id: id,
            players: []
        }

        let player = {
            socket: socket, 
            isAdmin: true
        }

        session.players.push(player);

        sessions.push(session);

        socket.emit('session create', id);
    });

    socket.on('session join', (id) => {
        console.log("Demande de join de session " + id);

        let result = {
            error: false
        }

        let session = sessions.find(x => x.id === id);

        if (!session) {
            result.error = true;
            result.message = "Code de session introuvable...";
        }

        socket.emit('session join', result);
    });

    socket.on('session quit', (id) => {
        console.log("Demande de quit de session " + id);

        let result = {
            error: false
        }

        let session = sessions.find(x => x.id === id);

        if (!session)
            return;

        let playerIndex = session.players.findIndex(x => x.socket.id === socket.id);

        if (!playerIndex == -1)
            return;
        
        session.players.splice(playerIndex, 1);
    });

    socket.on('disconnect', () => {
        console.log("Utilisateur déconnecté");

        sessions.forEach((session, index) => {
            let myPlayerIndex = session.players.findIndex(x => x.socket.id === socket.id);

            if (myPlayerIndex != -1) {
                session.players.splice(myPlayerIndex, 1);
            }

            if (session.players.length == 0) {
                sessions.splice(index, 1);
            }
        });

        console.log("Nombre de sessions restantes: " + sessions.length);
    });
});

function makeid() {
    let text = "";
    let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (let i = 0; i < 10; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}