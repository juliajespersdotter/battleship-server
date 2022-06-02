/**
 * Socket Controller
 */

const debug = require("debug")("battleship:socket_controller");
let io = null; // socket.io server instance

// list of games and their connected players

const games = [];


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
				players: game.players,
			};
		} else {
			return false;
		}
	});
	callback(game_list);
};

/**
 * Handle a player disconnecting
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

/**
 *
 * @param {string} username
 * @param {string}} game_id
 * @param {game} callback
 */
const handlePlayerJoined = async function (username, game_id, callback) {
	debug(
		`User ${username} with socket id ${this.id} wants to join room '${game_id}'`
	);

	// join room
	this.join(game_id);

	// find game
	let game = getGameById(game_id);

	// if no game, create new game
	if (!game) {
		let newGame = {
			id: game_id,
			name: game_id,
			players: {},
		};
		games.push(newGame);
		game = getGameById(game_id);
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
 * Handle a player leaving a game
 *
 */
const handlePlayerLeft = async function (username, game_id) {
	debug(`User ${username} with socket id ${this.id} left room '${game_id}'`);

	// leave game
	this.leave(game_id);

	const game = getGameById(game_id);

	if (!game) {
		return;
	}

	delete game.players[this.id];

	if (Object.keys(game.players).length === 0) {
		delete game.id;
		delete game.name;
	}

	// let everyone know that someone left the game
	this.broadcast
		.to(game.id)
		.emit("player:disconnected", game.players[this.id]);

	// broadcast list of players to everyone in the game
	io.to(game.id).emit("player:list", game.players);

	io.emit("new-game-list");
};

/**
 *
 * Chat Functionality
 */

const handleChatMessage = async function (data) {
	// debug("Someone said something: ", data);

	const game = getGameById(data.game);

	if (!game) {
		return;
	}

	// emit `chat:message` event to everyone EXCEPT the sender
	this.broadcast.to(game.id).emit("chat:message", data);
};

/**
 *
 * Game Functionality
 */
const handleShipData = async function (shipData) {
	if (shipData.shipTwo !== null) {
		this.broadcast.to(shipData.id).emit("get-ship-data", shipData);
	}
};

const handleShipsRemaining = function (id, totalShips) {
	// send ships remaining to opponent when sunk a ship
	this.broadcast.to(id).emit("get-ships-remaining", totalShips);
};

const handleAttackShip = function (game_id, attackClick, turn) {
	// handle player attacking a click
	this.broadcast.to(game_id).emit("get-enemy-click", attackClick);

	// change player turn after click
	io.to(game_id).emit("get-whose-turn", turn);
};

const handleGameOver = function (username, game_id) {
	// emit the winner to client
	io.to(game_id).emit("winner", username);
};

const handlePlayersReady = function (game_id) {
	// start game after player set their boats
	io.to(game_id).emit("start-game");
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

	// handle update game list
	socket.on("update-list", () => {
		io.emit("new-game-list");
	});

	// handle user emitting a new message
	socket.on("chat:message", handleChatMessage);

	// handle sending ship data to opponent
	socket.on("ship-data", handleShipData);

	// handle game over
	socket.on("game-over", handleGameOver);

	// handle player leaving
	socket.on("player:left", handlePlayerLeft);

	// handle ships remaining information
	socket.on("ships-remaining", handleShipsRemaining);

	// handle player joined
	socket.on("player:joined", handlePlayerJoined);

	// handle attacking ship
	socket.on("click-data-hit", handleAttackShip);

	// handle player ready and bard ready
	socket.on("player-ready", handlePlayersReady);
};
