/**
 * Socket Controller
 */

const debug = require("debug")("battleship:socket_controller");
let io = null; // socket.io server instance

// list of rooms and their connected users
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
 * Get room by ID
 *
 * @param {String} id ID of Room to get
 * @returns
 */
const getGameById = (id) => {
	return games.find((game) => game.id === id);
};

/**
 * Get room by User ID
 *
 * @param {String} id Socket ID of User to get Room by
 * @returns
 */
const getGameByUserId = (id) => {
	return games.find((gameRoom) => gameRoom.players.hasOwnProperty(id));
};

/**
 * Handle a user requesting a list of rooms
 *
 */
const handleGetGameList = function (callback) {
	// generate a list of rooms with only their id and name
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

	// send list of rooms back to the client
	callback(game_list);
};

/**
 * Handle a user disconnecting
 *
 */
const handleDisconnect = function () {
	debug(`Client ${this.id} disconnected :(`);

	// find the room that this socket is part of
	const game = getGameByUserId(this.id);

	// if socket was not in a game, don't broadcast disconnect
	if (!game) {
		return;
	}

	// let everyone in the game know that this user has disconnected
	this.broadcast
		.to(game.id)
		.emit("player:disconnected", game.players[this.id]);

	// remove user from list of users in that game
	delete game.players[this.id];

	// broadcast list of users in game to all connected sockets EXCEPT ourselves
	this.broadcast.to(game.id).emit("player:list", game.players);
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
	}

	// b) add socket to room's `users` object
	game.players[this.id] = username;

	// let everyone know that someone has joined the game
	this.broadcast.to(game.id).emit("player:joined", username);

	// confirm join
	callback({
		success: true,
		gameName: game.name,
		players: game.players,
	});

	// broadcast list of users to everyone in the room
	io.to(game.id).emit("player:list", game.players);
};

/**
 * Handle a user leaving a room
 *
 */
const handlePlayerLeft = async function (username, game_id) {
	debug(`User ${username} with socket id ${this.id} left room '${game_id}'`);

	// leave game
	this.leave(game_id);

	// remove socket from list of online users in this game
	// a) find game object with `id` === `general`
	const game = getGameById(game_id);

	// b) remove socket from game's `users` object
	delete game.players[this.id];
	delete game;

	// let everyone know that someone left the game
	this.broadcast.to(game.id).emit("player:left", username);

	// broadcast list of users to everyone in the game
	io.to(game.id).emit("user:list", game.players);
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

	// handle user leave
	socket.on("player:left", handlePlayerLeft);

	// handle player joined
	socket.on("player:joined", handlePlayerJoined);
};
