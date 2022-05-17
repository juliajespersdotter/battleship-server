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
 * Handle a user requesting a list of rooms
 *
 */
const handleGetGameList = function (callback) {
	// generate a list of rooms with only their id and name
	const game_list = games.map((game) => {
		return {
			id: game.id,
			name: game.name,
		};
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
};
