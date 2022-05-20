/**
 * Socket Controller
 */

const debug = require("debug")("battleship:socket_controller");
let io = null; // socket.io server instance

// list of games and their connected players
const games = [
	{
		id: "1",
		name: "1",
		players: {},
	},
	{
		id: "2",
		name: "2",
		players: {},
	},
	{
		id: "3",
		name: "3",
		players: {},
	},
];

/**
 * Get game by ID
 *
 * @param {String} id ID of Game to get
 * @returns
 */
const getGameById = (id) => {
	return games.find((game) => game.id === id);
};

/**
 * Get room by Player ID
 *
 * @param {String} id Socket ID of Player to get Game by
 * @returns
 */
const getGameByUserId = (id) => {
	return games.find((gameRoom) => gameRoom.players.hasOwnProperty(id));
};

/**
 * Handle a player requesting a list of games
 *
 */
const handleGetGameList = function (callback) {
	// generate a list of games with only their id and name
	const game_list = games.map((game) => {
		if (Object.keys(game.players).length < 2) {
			return {
				id: game.id,
				name: game.name,
			};
		} else {
			return false;
		}
	});

	// send list of games back to the client
	callback(game_list);
};

const handleCheckGames = function (game, callback) {
	let newGame = getGameById(game);

	if (!newGame) {
		callback({
			success: true,
		});
		return;
	}

	callback({
		success: false,
	});
};

/**
 * Handle a user disconnecting
 *
 */
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected :(`);

	// find the game that this socket is part of
	const game = getGameByUserId(this.id);

	// if socket was not in a game, don't broadcast disconnect
	if (!game) {
		return;
	}

	// let everyone in the game know that this player has disconnected
	this.broadcast
		.to(game.id)
		.emit("player:disconnected", game.players[this.id]);

	// remove player from list of users in that game
	delete game.players[this.id];

	if (Object.keys(game.players).length === 0) {
		delete game.id;
		delete game.name;
	}

	// broadcast list of players in game to all connected sockets EXCEPT ourselves
	this.broadcast.to(game.id).emit("player:list", game.players);
	io.emit("new-game-list");
};

const handlePlayerJoined = async function (username, game_id, callback) {
	debug(
		`User ${username} with socket id ${this.id} wants to join room '${game_id}'`
	);

	// join room
	this.join(game_id);

	// add socket to list of players in this game
	// a) find room object with `id` === `general`
	let game = getGameById(game_id);

	if (!game) {
		let newGame = {
			id: game_id,
			name: game_id,
			players: {},
		};
		games.push(newGame);
		game = getGameById(game_id);

		console.log("new game:", game);
	}

	// b) add socket to game's `players` object
	game.players[this.id] = username;

	// let everyone know that someone has joined the game
	this.broadcast.to(game.id).emit("player:joined", username);

	// confirm join
	callback({
		success: true,
		gameName: game.name,
		players: game.players,
	});

	// broadcast list of players to everyone in the room
	io.to(game.id).emit("player:list", game.players);
};

/**
 * Handle a player leaving a room
 *
 */
const handlePlayerLeft = async function (username, game_id) {
	debug(`User ${username} with socket id ${this.id} left room '${game_id}'`);

	// leave game
	this.leave(game_id);

	// remove socket from list of online players in this game
	const game = getGameById(game_id);

	delete game.players[this.id];
	console.log(game.players);

	if (Object.keys(game.players).length === 0) {
		delete game.id;
		delete game.name;
		console.log("game after delete:", game);
	}

	// let everyone know that someone left the game
	this.broadcast.to(game.id).emit("player:left", username);

	// broadcast list of players to everyone in the game
	io.to(game.id).emit("player:list", game.players);
	io.emit("new-game-list");
};

/**
 * Export controller and attach handlers to events
 *
 */
module.exports = function (socket, _io) {
	// save a reference to the socket.io server instance
	io = _io;

	debug(`Client ${socket.id} connected`);

	// handle user disconnect
	socket.on("disconnect", handleDisconnect);

	// handle get game list request
	socket.on("get-game-list", handleGetGameList);

	socket.on("update-list", () => {
		io.emit("new-game-list");
	});

	// socket.on("create-custom", handleCreateCustom);

	socket.on("check-games", handleCheckGames);

	// handle user leave
	socket.on("player:left", handlePlayerLeft);

	// handle player joined
	socket.on("player:joined", handlePlayerJoined);
};
