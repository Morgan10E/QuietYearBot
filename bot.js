var Discord = require('discord.io');
var logger = require('winston');
var auth = require('./auth.json');
var info = require('./info.json');
var deck = info.deck;
var seasons = info.deck_order;

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

// Initialize Discord Bot
var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Ready!');
});

// Setup game state
var state = 'over';
var nCards = 13;
var nDraws = 0;
var players = [];
var currentPlayer = 0;
var currentSeason = 0;

var projects = {}; // { username -> list of projects }
var contempt = {}; // { player -> amount of contempt }

var reset = function() {
    state = 'over';
    nCards = 13;
    nDraws = 0;
    players = [];
    currentPlayer = 0;
    currentSeason = 0;
    projects = {};
    contempt = {};
};

var commands = {
    'help' : 'Display these commands.',
    'start' : 'Start a new game. !start',
    'end' : 'Finish this game. !end',
    'register' : 'Sign up to play. !register',
    'unregister' : 'Get off the list of players. !unregister',
    'draw': 'Draw the next card. Only the player whose turn it is can draw. !draw',
    'contempt': 'Show contempt for the actions of the player whose turn it is, or see how much contempt another player has. !contempt, !contempt <username>',
    'withdraw': 'Get rid of contempt to justify a selfish action or because a conflict was resolved. !withdraw',
    'project': 'Start a project that will take longer than a week, or terminate a project. !project <#weeks> <description>, !project <id>',
    'countdown': 'Mark down a week for all projects. !countdown',
    'turn': 'Whose turn is it? !turn'
};

bot.on('message', function (user, userID, channelID, message, evt) {
    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 1) == '!') {
        var args = message.substring(1).split(' ');
        var cmd = args[0];
       
        if (!commands[cmd]) {
            bot.sendMessage({
                to: channelID,
                message: 'Invalid command: ' + cmd
            });
            return;
        }
        console.log(cmd);

        var response = '';

        args = args.splice(1);
        switch(cmd) {
            // !ping
            case 'help':
                response = 'Possible commands in Quiet Year. Type !<command>.\n';
                for (var command in commands) {
                    response += command + ': ' + commands[command] + '\n';
                }
            break;
            case 'start':
                if (state != 'over') {
                    response = 'There\'s already a game in progress. Type !end to finish the game before starting a new one.';
                } else if (players.length == 0) {
                    response = 'Can\'t play without players! Type !register to sign up for the game, then !start when everyone is signed up.';
                } else {
                    response = 'Starting a game with players:\n';
                    for (var i = 0; i < players.length; i++) {
                        response += '\t' + players[i] + '\n';
                        projects[players[i]] = [];
                        contempt[players[i]] = 0;
                    }
                    response += info.intro;

                    response += '\nWhen you\'ve finished getting the map ready, ' + players[currentPlayer] + ' will draw the first card. See where the story takes you!';

                    state = 'playing';
                }
            break;
            case 'register':
                if (state != 'over') {
                    response = 'There\'s already a game in progress. Sign up for the next one :)';
                } else {
                    if (!players.includes(user)) {
                        if (players.length > 4) {
                            response += 'Sorry, the max number of players are already signed up.\n';
                        } else {
                            players.push(user);
                            response += 'Registered ' + user + '\n';
                        }
                    } else {
                        response += 'You\'re already signed up!\n';
                    }
                    response += 'Signed up players:\n';
                    for (var i = 0; i < players.length; i++) {
                        response += '\t' + players[i] + '\n';
                    }
                }
                break;
            case 'unregister':
                if (state != 'over') {
                    response = 'The game\'s already in progress!';
                } else {
                    if (!players.includes(user)) {
                        response += 'You\'re not signed up!\n';
                    } else {
                        players.splice(players.indexOf(user), 1);
                        response += 'Unregistered ' + user + '\n';
                    }
                    response += 'Signed up players:\n';
                    for (var i = 0; i < players.length; i++) {
                        response += '\t' + players[i] + '\n';
                    }
                }
                break;
            case 'end':
                reset();
                response = 'Reset the game!';
            break;
            case 'draw':
                if (state == 'over') {
                    response = 'Start a game!';
                } else {
                    if (user != players[currentPlayer]) {
                        response = 'It\'s ' + players[currentPlayer] + '\'s turn.';
                    } else {
                        if (deck[seasons[currentSeason]].length == 0) {
                            currentSeason++;
                            response = 'The seasons turn. It is now *' + seasons[currentSeason] + '*.\n\n';
                        }

                        var seasonCards = deck[seasons[currentSeason]];
                        var remaining = seasonCards.length;
                        var cardIndex = Math.floor(remaining * Math.random());
                        var card = seasonCards[cardIndex];
                        var content = card.content;
                        deck[seasons[currentSeason]].splice(cardIndex, 1);

                        if (content.length > 0) {
                            response += content[0] + '\n-or-\n' + content[1];
                        } else {
                            response += content[0];
                        }

                        if (card.game_ender) {
                            response = '';
                            reset();
                        } else {
                            response += '\n\nAfter ' + players[currentPlayer] + ', it will be ';
                            currentPlayer = (currentPlayer + 1) % players.length;
                            response += players[currentPlayer] + '\'s turn.';
                        }
                    }
                }
            break;
            case 'contempt':
                if (state != 'playing') {
                    response = 'Start a game!';
                } else {
                    if (args.length == 0) {
                        contempt[user]++;
                    } else {
                        var target = args[0];
                        response += target + ' has ' + contempt[target] + ' contempt before them.';
                    }
                }
                break;
            case 'withdraw':
                if (state != 'playing') {
                    response = 'Start a game!';
                } else {
                    if (contempt[user] > 0) {
                        contempt[user]--;
                    } else {
                        response += user + ' has no contempt to spend';
                    }
                }
                break;
            case 'project':
                if (state != 'playing') {
                    response = 'Start a game!';
                } else {
                    if (args.length == 0) {
                        // print all projects
                        for (var player in projects) {
                            if (projects[player].length == 0) continue;
                            response += player + '\n';
                            for (var i = 0; i < projects[player].length; i++) {
                                response += '\t' + (i+1) + '. ' + projects[player][i].description + ' (' + projects[player][i].weeks + ' weeks remaining)';
                            }
                        }
                    } else if (args.length == 1) {
                        // terminate a project
                        projects[user].splice(args[0] - 1, 1);
                    } else if (args.length > 1) {
                        // new project
                        var nWeeks = args[0];
                        var description = args.splice(1).join(' ');
                        projects[user].push({
                            weeks : nWeeks,
                            description : description,
                        });
                    }
                }
                break;
            case 'countdown':
                if (state != 'playing') {
                    response = 'Start a game!';
                } else {
                    for (var player in projects) {
                        if (projects[player].length == 0) continue;
                        for (var i = projects[player].length - 1; i >= 0; i--) {
                            projects[player][i].weeks = projects[player][i].weeks - 1;
                            if (projects[player][i].weeks == 0) {
                                response += '\t' + projects[player][i].description + ' done!';
                                projects[player].splice(i, 1);
                            }
                        }
                    }
                }
                break;
            case 'turn':
                response = 'It\'s ' + players[currentPlayer] + '\'s turn.';
                break;
         }
        bot.sendMessage({
            to: channelID,
            message: response
        });
     }
});