import { DiscordMinimal, INTENTS, DiscordUser, Snowflake, DiscordEmbed, DiscordReady, DiscordMessageReactionAdd, DiscordMessage, DiscordMessageCreate, DiscordInteraction, DiscordMessageDelete, DiscordMessageDeleteBulk, DiscordGuild, PERMISSIONS, DiscordApplicationCommand, DiscordApplicationCommandOption, DiscordApplicationCommandOptionType } from 'discord-minimal';
import { token } from './config';
import SnakeGame from './snake';
import HangmanGame from './hangman';
import MinesweeperGame from './minesweeper';
import Connect4Game from './connect4';
import ChessGame from './chess';
import TicTacToeGame from './tic-tac-toe';
import GameBase from './game-base';
import GameResult, { ResultType } from './game-result';
import FloodGame from './flood';
import TwentyFortyEightGame from './2048';
import { DiscordApplicationCommandType } from 'discord-minimal/output/src/custom-types/discord-application-command-type';

const client = new DiscordMinimal([INTENTS.GUILDS, INTENTS.GUILD_MESSAGES, INTENTS.GUILD_MESSAGE_REACTIONS]);

const minesweeper = new MinesweeperGame();

type CommandObject = {
    [key: string]: () => GameBase;
}
const commandGameMap: CommandObject = {
    'snake': () => new SnakeGame(),
    'hangman': () => new HangmanGame(),
    'connect4': () => new Connect4Game(),
    'minesweeper': () => minesweeper,
    'chess': () => new ChessGame(),
    'tictactoe': () => new TicTacToeGame(),
    'flood': () => new FloodGame(),
    '2048': () => new TwentyFortyEightGame(),
};

const playerGameMap = new Map<Snowflake, Map<Snowflake, GameBase>>();

let botId = -1;

client.on('ready', (ready: DiscordReady) => {
    ready.user.setActivity('!gbhelp');
    botId = ready.user.id;
    console.log(`Logged in as ${ready.user?.username}!`);

    initCommands(ready.application.id);
});

function initCommands(appId: Snowflake) {
    const vsSubCommand = new DiscordApplicationCommandOption('vs', 'User you wish to play against', DiscordApplicationCommandOptionType.USER);

    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'gamesbot', 'GamesBot help and info'));
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'listgames', 'List available games'));
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'endgame', 'End the game you are currently playing'));
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'snake', 'Play Snake'));
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'hangman', 'Play Hangman'));
    const connect4Command = new DiscordApplicationCommand(appId, 'connect4', 'Play Connect4');
    connect4Command.addOption(vsSubCommand);
    client.createGlobalCommand(connect4Command);
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'minesweeper', 'Play Minesweeper'));
    const ticTacToeCommand = new DiscordApplicationCommand(appId, 'tictactoe', 'Play Tic-Tac-Toe');
    ticTacToeCommand.addOption(vsSubCommand);
    client.createGlobalCommand(ticTacToeCommand);
    const chessCommand = new DiscordApplicationCommand(appId, 'chess', 'Play Chess');
    chessCommand.addOption(vsSubCommand);
    client.createGlobalCommand(chessCommand);
    client.createGlobalCommand(new DiscordApplicationCommand(appId, 'flood', 'Play Flood'));
    client.createGlobalCommand(new DiscordApplicationCommand(appId, '2048', 'Play 2048'));
}

client.on('interactionCreate', (interaction: DiscordInteraction) => {
    const userGame = getPlayersGame(interaction.guild_id as Snowflake, interaction.member?.user?.id as Snowflake);

    if (interaction.isAppCommand()) {
        if (!interaction.guild_id) {
            interaction.respond({ content: 'This command can only be run inside a guild!' }).catch(console.log);
            return;
        }

        const guildId: Snowflake = interaction.guild_id;
        const userId = interaction.member?.user?.id ?? interaction.user?.id;
        const command = interaction.data?.name;
        if (!command || !userId) {
            interaction.respond({ content: 'The command or user was missing somehow.... awkward...' }).catch(console.log);
            return;
        }
        if (Object.keys(commandGameMap).includes(command)) {
            const game = commandGameMap[command]();

            const player2Option = interaction.data?.options.find(o => o.name === 'vs');
            let player2: DiscordUser | undefined;
            if (player2Option) {
                if (!game.doesSupportMultiplayer()) {
                    interaction.respond({ content: 'Sorry that game is not a multiplayer game!' }).catch(console.log);
                    return;
                }
                else {
                    const users = interaction.data?.resolved?.users;
                    const player2Id = player2Option.value as Snowflake;
                    player2 = player2Id && users ? users[player2Id] : undefined;
                }
            }
            if (userId === player2?.id) {
                interaction.respond({ content: 'You cannot play against yourself!' }).catch(console.log);
                return;
            }

            if (!playerGameMap.has(guildId))
                playerGameMap.set(guildId, new Map<Snowflake, GameBase>());

            if (userGame) {
                interaction.respond({ content: 'You must either finish or end your current game (!end) before you can play another!' }).catch(console.log);
                return;
            }
            else if (player2 && playerGameMap.get(guildId)?.has(player2.id)) {
                interaction.respond({ content: 'The person you are trying to play against is already in a game!' }).catch(console.log);
                return;
            }

            const foundGame = Array.from(playerGameMap.get(guildId)?.values() ?? []).find(g => g.getGameId() === game.getGameId());
            if (foundGame !== undefined && foundGame.isInGame()) {
                interaction.respond({ content: 'Sorry, there can only be 1 instance of a game at a time!' }).catch(console.log);
                return;
            }

            game.newGame(interaction, player2 ?? null, (result: GameResult) => {
                playerGameMap.get(guildId)?.delete(userId);
                if (player2)
                    playerGameMap.get(guildId)?.delete(player2.id);
            });
            playerGameMap.get(guildId)?.set(userId, game);
            if (player2)
                playerGameMap.get(guildId)?.set(player2.id, game);
        }
        else if (command === 'endgame') {
            const playerGame = playerGameMap.get(guildId);
            if (!!playerGame && playerGame.has(userId)) {
                const game = playerGame.get(userId);
                if (game) {
                    game.gameOver({ result: ResultType.FORCE_END });
                    if (game?.player2)
                        playerGame.delete(game.player2.id);
                }
                playerGame.delete(userId);
                interaction.respond({ content: 'Your game was ended!' }).catch(console.log);
                return;
            }
            interaction.respond({ content: 'Sorry! You must be in a game first!' }).catch(console.log);
            return;
        }
        else if (command === 'listgames') {
            const embed = new DiscordEmbed()
                .setColor('#fc2eff')
                .setTitle('Avilable Games')
                .setDescription(`
                🐍 - Snake
                
                🅰️ - Hangman
                
                🔵 - Connect4
                
                💣 - Minesweeper
                
                ♟️ - Chess
                
                ❌ - Tic-Tac-Toe
                
                🟪 - Flood
                
                8️⃣ - 2048
                `)
                .setTimestamp();
            interaction.respond({ embeds: [embed] }).catch(console.log);
        }
        else if (command === 'gamesbot') {
            const embed = new DiscordEmbed()
                .setColor('#fc2eff')
                .setTitle('Games Bot')
                .setDescription('Welcome to GamesBot!\nThis bot adds lots of little games that you can play right from your Discord chat!\nUse /listgames to list all available games!\nAll games are started via slash commands and any game can be ended using /endgame.\nOnly 1 instance of each game may be active at a time and a user can only be playing 1 instance of a game at a time')
                .setTimestamp();
            interaction.respond({ embeds: [embed] }).catch(console.log);
        }

        return;
    }

    if (!userGame) {
        interaction.deferUpdate().catch(console.log);
        return;
    }

    userGame.onInteraction(interaction);
});

client.on('messageReactionAdd', (reaction: DiscordMessageReactionAdd) => {
    const userId = reaction.user_id;
    const userGame = getPlayersGame(reaction.guild_id ?? null, userId);
    if (!userGame)
        return;

    if (userGame.player1Turn && userId !== userGame.gameStarter.id)
        return;
    if (!userGame.player1Turn && !!userGame.player2?.id && userId !== userGame.player2.id)
        return;
    if (!userGame.player1Turn && !userGame.player2?.id && userId !== userGame.gameStarter.id)
        return;

    userGame.onReaction(reaction);
    reaction.remove();
});

client.on('messageDelete', (message: DiscordMessageDelete) => {
    handleMessageDelete(message.guild_id, message.id);
});

client.on('messageDeleteBulk', (messages: DiscordMessageDeleteBulk) => {
    messages.ids.forEach((id: Snowflake) => handleMessageDelete(messages.guild_id, id));
});

const handleMessageDelete = (guild_id: Snowflake | undefined, message_id: Snowflake) => {
    if (!guild_id)
        return;

    const guidGames = playerGameMap.get(guild_id);
    if (!guidGames)
        return;

    guidGames.forEach((game: GameBase, userId: Snowflake) => {
        if (game.getMessageId() === message_id)
            game.gameOver({ result: ResultType.DELETED });
    });
};

const getPlayersGame = (guildId: Snowflake | null, userId: Snowflake): GameBase | null => {
    if (!guildId)
        return null;

    const guidGames = playerGameMap.get(guildId);
    if (!guidGames)
        return null;

    const userGame = guidGames.get(userId);
    if (!userGame)
        return null;

    return userGame;
};

client.login(token);