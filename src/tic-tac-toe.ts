import { DiscordUser, DiscordEmbed, DiscordInteraction, DiscordMessageReactionAdd, DiscordInteractionResponseMessageData } from 'discord-minimal';
import GameBase from './game-base';
import GameResult, { ResultType } from './game-result';
import Position from './position';

const NO_MOVE = 0;
const PLAYER_1 = 1;
const PLAYER_2 = 2;

const cpu_mistake_chance = 5;

export default class TicTacToeGame extends GameBase {

    private message = '';
    private computersMove: Position = { x: 0, y: 0 };
    private winningPoints: Position = { x: -1, y: -1 };

    private gameBoard = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

    constructor() {
        super('tictactoe', true);
    }

    private getGameBoardStr(): string {
        let str = '';
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                str += this.gameBoard[x][y];
            }
        }
        return str;
    }

    public newGame(interaction: DiscordInteraction, player2: DiscordUser | null, onGameEnd: (result: GameResult) => void): void {
        if (this.inGame)
            return;

        for (let y = 0; y < 3; y++)
            for (let x = 0; x < 3; x++)
                this.gameBoard[x][y] = NO_MOVE;

        this.winningPoints = { x: -1, y: -1 };

        super.newGame(interaction, player2, onGameEnd);
    }

    private getBaseEmbed(): DiscordEmbed {
        return new DiscordEmbed()
            .setColor('#ab0e0e')
            .setTitle('Tic-Tac-Toe')
            .setAuthor('Made By: TurkeyDev', 'https://site.theturkey.dev/images/turkey_avatar.png', 'https://www.youtube.com/watch?v=tgY5rpPixlA')
            .setTimestamp();
    }

    protected getContent(): DiscordInteractionResponseMessageData {
        const row1 = super.createMessageActionRowButton([['1', '1️⃣'], ['2', '2️⃣'], ['3', '3️⃣']]);
        const row2 = super.createMessageActionRowButton([['4', '4️⃣'], ['5', '5️⃣'], ['6', '6️⃣']]);
        const row3 = super.createMessageActionRowButton([['7', '7️⃣'], ['8', '8️⃣'], ['9', '9️⃣']]);

        const resp = new DiscordInteractionResponseMessageData();
        resp.embeds = [this.getBaseEmbed()
            .setDescription(this.message)
            .addField('Turn:', this.getTurn())
            .setImage(`https://api.theturkey.dev/discordgames/gentictactoeboard?gb=${this.getGameBoardStr()}&p1=-1&p2=-1`)
            .setFooter(`Currently Playing: ${this.gameStarter.username}`)];
        resp.components = [row1, row2, row3];
        return resp;
    }

    protected getGameOverContent(result: GameResult): DiscordInteractionResponseMessageData {
        const resp = new DiscordInteractionResponseMessageData();
        resp.embeds = [this.getBaseEmbed()
            .setDescription('GAME OVER! ' + this.getWinnerText(result))
            .setImage(`https://api.theturkey.dev/discordgames/gentictactoeboard?gb=${this.getGameBoardStr()}&p1=${this.winningPoints.x}&p2=${this.winningPoints.y}`)];
        return resp;
    }

    public onReaction(reaction: DiscordMessageReactionAdd): void { }

    public onInteraction(interaction: DiscordInteraction): void {
        const sender = interaction.member?.user?.id;
        const turnPlayerId = this.player1Turn ? this.gameStarter.id : (this.player2 ? this.player2.id : this.gameStarter.id);
        if (sender !== turnPlayerId) {
            interaction.deferUpdate().catch(() => console.log('Failed to defer interaction for wrong player!'));
            return;
        }

        const customId = interaction.data?.custom_id;
        if (!customId) {
            this.step(false);
            interaction.update(this.getContent()).catch(e => super.handleError(e, 'update interaction'));
            return;
        }

        let index = parseInt(customId);
        if (index === undefined || index <= 0 || Number.isNaN(index)) {
            console.log('Error with index! ' + customId + ' -> ' + index);
            interaction.update(this.getContent()).catch(e => super.handleError(e, 'update interaction'));
            return;
        }

        index -= 1;
        const x = index % 3;
        const y = Math.floor(index / 3);
        if (this.gameBoard[x][y] !== 0) {
            this.step(false);
            interaction.update(this.getContent()).catch(e => super.handleError(e, 'update interaction'));
            return;
        }

        this.placeMove(x, y, this.player1Turn ? PLAYER_1 : PLAYER_2);
        this.player1Turn = !this.player1Turn;

        if (!this.isGameOver() && !this.player2 && !this.player1Turn) {
            //Make CPU Move
            this.minimax(0, PLAYER_2);
            const cpuIndex = (this.computersMove.y * 3) + this.computersMove.x + 1;

            this.placeMove(this.computersMove.x, this.computersMove.y, PLAYER_2);
            this.player1Turn = true;
        }

        if (this.isGameOver()) {
            //Flip the turn back to the last player to place a piece
            this.player1Turn = !this.player1Turn;
            if (this.hasWon(PLAYER_2) || this.hasWon(PLAYER_1))
                this.gameOver({ result: ResultType.WINNER, name: this.getTurn(), score: this.getGameBoardStr() }, interaction);
            else
                this.gameOver({ result: ResultType.TIE, score: this.getGameBoardStr() }, interaction);
        }
        else {
            this.step(false);
            interaction.update(this.getContent()).catch(e => super.handleError(e, 'update interaction'));
        }
    }

    private getTurn(): string {
        return this.player1Turn ? this.gameStarter.username : (this.player2 ? this.player2?.username : 'CPU');
    }

    private isGameOver(): boolean {
        if (this.hasWon(PLAYER_1) || this.hasWon(PLAYER_2))
            return true;

        if (this.getAvailableStates().length == 0) {
            this.winningPoints = { x: -1, y: -1 };
            return true;
        }
        return false;
    }

    private hasWon(player: number): boolean {
        if (this.gameBoard[0][0] == this.gameBoard[1][1] && this.gameBoard[0][0] == this.gameBoard[2][2] && this.gameBoard[0][0] == player) {
            this.winningPoints = { x: 0, y: 8 };
            return true;
        }
        if (this.gameBoard[0][2] == this.gameBoard[1][1] && this.gameBoard[0][2] == this.gameBoard[2][0] && this.gameBoard[0][2] == player) {
            this.winningPoints = { x: 6, y: 2 };
            return true;
        }
        for (let i = 0; i < 3; ++i) {
            if (this.gameBoard[i][0] == this.gameBoard[i][1] && this.gameBoard[i][0] == this.gameBoard[i][2] && this.gameBoard[i][0] == player) {
                this.winningPoints = { x: i, y: i + 6 };
                return true;
            }

            if (this.gameBoard[0][i] == this.gameBoard[1][i] && this.gameBoard[0][i] == this.gameBoard[2][i] && this.gameBoard[0][i] == player) {
                this.winningPoints = { x: i * 3, y: (i * 3) + 2 };
                return true;
            }
        }
        return false;
    }

    private getAvailableStates(): Position[] {
        const availablePoints: Position[] = [];
        for (let i = 0; i < 3; ++i)
            for (let j = 0; j < 3; ++j)
                if (this.gameBoard[i][j] == NO_MOVE)
                    availablePoints.push({ x: i, y: j });
        return availablePoints;
    }

    private placeMove(x: number, y: number, player: number): void {
        this.gameBoard[x][y] = player;
    }

    private minimax(depth: number, turn: number): number {
        //Game status...
        if (this.hasWon(PLAYER_2))
            return +1;
        if (this.hasWon(PLAYER_1))
            return -1;

        const pointsAvailable = this.getAvailableStates();
        if (pointsAvailable.length === 0)
            return 0;

        if (depth == 0 && Math.floor(Math.random() * Math.floor(cpu_mistake_chance)) == 2) {
            this.computersMove = pointsAvailable[Math.floor(Math.random() * Math.floor(pointsAvailable.length))];
            return 0;
        }


        let min = Number.MAX_SAFE_INTEGER;
        let max = Number.MIN_SAFE_INTEGER;
        for (let i = 0; i < pointsAvailable.length; ++i) {
            const point = pointsAvailable[i];
            if (turn == PLAYER_2) {
                this.placeMove(point.x, point.y, PLAYER_2);
                const currentScore = this.minimax(depth + 1, PLAYER_1);
                max = Math.max(currentScore, max);

                if (currentScore >= 0 && depth == 0)
                    this.computersMove = point;

                if (currentScore == 1) {
                    this.gameBoard[point.x][point.y] = 0;
                    break;
                }

                if (i == pointsAvailable.length - 1 && max < 0 && depth == 0)
                    this.computersMove = point;
            }
            else if (turn == PLAYER_1) {
                this.placeMove(point.x, point.y, PLAYER_1);
                const currentScore = this.minimax(depth + 1, PLAYER_2);
                min = Math.min(currentScore, min);
                if (min == -1) {
                    this.gameBoard[point.x][point.y] = 0;
                    break;
                }
            }
            this.gameBoard[point.x][point.y] = 0;
        }
        return turn == PLAYER_2 ? max : min;
    }
}