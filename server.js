var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var _ = require('lodash');

var port = process.env.PORT || 8080;

console.log("Ecoute sur le port " + port);
server.listen(port);

app.get('/', function (req, res) {
    res.send("API of the Airsoft Taka Tracker");
});

let sessions = [];

io.on('connection', function (socket) {
    console.log("Utilisateur connecté !");

    socket.on('session create', () => {
        let id = makeid();

        console.log(`Demande de creation de session (${id})`);
        
        let result = {
            error: false
        }

        let session = {
            id: id,
            players: []
        }

        let player = {
            socket: socket, 
            isAdmin: true,
            isDebug: false,
            rank: ranks[ranks.length - 1],
            specialisation: specialisations[0]
        }

        session.players.push(player);

        sessions.push(session);

        //DEBUG
        let debugPlayer = {
            socket: {id: 'DEBUGTESTPLAYER'}, 
            isAdmin: false,
            isDebug: true,
            position: { lat: 43.7838413, lng: 1.3588779 },
            rank: ranks[0],
            specialisation: specialisations[0]
        }

        socket.join('session ' + id);
        console.log("Join session " + 'session ' + id);

        session.players.push(debugPlayer);

        result.id = id;
        result.players = formatPlayersBeforSending(session.players);
    
        socket.emit('session create', result);
    });

    socket.on('session join', (id) => {
        console.log(`Demande de join de session (${id})`);

        let result = {
            error: false
        }

        let session = sessions.find(x => x.id === id);

        if (!session) {
            result.error = true;
            result.message = "Code de session introuvable...";
        }

        let player = {
            socket: socket, 
            isAdmin: false,
            isDebug: false,
            rank: ranks[0],
            specialisation: specialisations[0]
        }

        session.players.push(player);

        socket.join('session ' + id);

        result.players = formatPlayersBeforSending(session.players);

        socket.emit('session join', result);
    });

    socket.on('session quit', (id) => {
        console.log(`Demande de quit de session (${id})`);

        let result = {
            error: false
        }

        socket.leave('session ' + id);

        let session = sessions.find(x => x.id === id);

        if (!session)
            return;

        let playerIndex = session.players.findIndex(x => x.socket.id === socket.id);

        if (!playerIndex == -1)
            return;
        
        session.players.splice(playerIndex, 1);
    });

    let possibleTeams = [
        { name: "Bleue", color: "blue" },
        { name: "Rouge", color: "red" },
        { name: "Verte", color: "green" },
        { name: "Violette", color: "violet" },
        { name: "Jaune", color: "yellow" }
    ]
    socket.on('team create', () => {
        let session = getPlayerSession(socket.id);
        let done = false;

        console.log("Demande création team !");

        if (!session.teams){
            session.teams = [];
        }

        for (let i = 0; i < possibleTeams.length; i++) {
            let possibleTeam = possibleTeams[i];
            
            if (!session.teams.find(x => x.name == possibleTeam.name)) {
                session.teams.push(_.clone(possibleTeam));
                done = true;
                break;
            }
        }

        if (done) {
            console.log("Equipe créée !" + session.id);
            io.to('session ' + session.id).emit('team create', session.teams);
        }
    });

    let ranks = [
        { name: "2nd Private", order: 0 },
        { name: "Private 1st", order: 1 },
        { name: "Corporal", order: 2 },
        { name: "Sergeant", order: 3 },
        { name: "First Lieutenant", order: 4 },
        { name: "General", order: 5 },
    ]
    socket.on('rank list', () => {
        socket.emit('rank list', ranks);
    });

    let specialisations = [
        { name: "Infrantry", icon: "contact" },
        { name: "Medic", icon: "medical" },
        { name: "Reconnaissance", icon: "medical" },
    ]
    socket.on('specialisation list', () => {
        socket.emit('specialisation list', specialisations);
    });

    socket.on('specialisation change', specialisationName => {
        let session = getPlayerSession(socket.id);
        let specialisation = specialisations.find(x => x.name == specialisationName);
        let player = getPlayerInSession(socket.id);

        player.specialisation = specialisation;

        io.to('session ' + session.id).emit('specialisation change', formatPlayersBeforSending(session.players));
    });

    socket.on('rank change', rankOrder => {
        let session = getPlayerSession(socket.id);
        let rank = ranks.find(x => x.order == rankOrder);
        let player = getPlayerInSession(socket.id);

        player.rank = rank;

        io.to('session ' + session.id).emit('rank change', formatPlayersBeforSending(session.players));
    });

    socket.on('team change', teamName => {
        let session = getPlayerSession(socket.id);
        let team = session.teams.find(x => x.name == teamName);
        let player = getPlayerInSession(socket.id);

        player.team = team;

        console.log("Sent !");

        io.to('session ' + session.id).emit('team change', formatPlayersBeforSending(session.players));
    });

    socket.on('player position', (position) => {
        console.log("Reception de la position de l'utilisateur " + socket.id);
        console.log(position);

        let session = getPlayerSession(socket.id);
        if (!session) {
            console.log("Session du joueur introuvable");
            return;
        }

        let player = session.players.find(x => x.socket.id === socket.id);

        player.position = position;

        let positionsToSend = session.players.map(x => {
            let positionToSend = { id: x.socket.id, position: x.position };

            if (x.isDebug) {
                positionToSend.position.lat += 0.0001;
                positionToSend.position.lng += 0.0001;
            }

            // si on ne veut pas le joueru qui vient d'envoyer les résultats
            // if (x.socket.id != socket.id)
                return positionToSend;
        }).filter(x => x != undefined);
    
        socket.emit('player position', positionsToSend);
    });

    socket.on('player detail', (id) => {
        let session = getPlayerSession(id);

        let player = getPlayerInSession(id);

        let playerFormatted = formatPlayerBeforSending(player);

        socket.emit('player detail', playerFormatted);
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
  
    for (let i = 0; i < 6; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

function getPlayerSession(socketId) {
    let session = sessions.find(x => {
        let player = x.players.find(player => player.socket.id == socketId);

        return player;
    });

    return session;
}

function getPlayerInSession(socketId) {
    let session = getPlayerSession(socketId);

    if (socketId == 'DEBUGTESTPLAYER')
        return session.players.find(x => x.isDebug);

    return session.players.find(
        x => !x.isDebug && x.socket.id === socketId
    );
}

function formatPlayerBeforSending(player) {
    if (player.socket)
        player.id = player.socket.id;
    else if (player.isDebug)
        player.id = 'DEBUGTESTPLAYER';

    return _.omit(player, ['socket']);
}

function formatPlayersBeforSending(players) {
    return players.map(x => formatPlayerBeforSending(x));
}