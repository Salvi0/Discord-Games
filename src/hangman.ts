import GameBase from './game-base';
import GameResult, { ResultType } from './game-result';
import fetch from 'node-fetch';
import { DiscordUser, DiscordEmbed, DiscordMessageReactionAdd, DiscordInteraction, DiscordInteractionResponseMessageData } from 'discord-minimal';

//unicode fun...
const reactions = new Map([
    ['🅰️', 'A'],
    ['🇦', 'A'],
    ['🅱️', 'B'],
    ['🇧', 'B'],
    ['🇨', 'C'],
    ['🇩', 'D'],
    ['🇪', 'E'],
    ['🇫', 'F'],
    ['🇬', 'G'],
    ['🇭', 'H'],
    ['ℹ️', 'I'],
    ['🇮', 'I'],
    ['🇯', 'J'],
    ['🇰', 'K'],
    ['🇱', 'L'],
    ['Ⓜ️', 'M'],
    ['🇲', 'M'],
    ['🇳', 'N'],
    ['🅾️', 'O'],
    ['⭕', 'O'],
    ['🇴', 'O'],
    ['🅿️', 'P'],
    ['🇵', 'P'],
    ['🇶', 'Q'],
    ['🇷', 'R'],
    ['🇸', 'S'],
    ['🇹', 'T'],
    ['🇺', 'U'],
    ['🇻', 'V'],
    ['🇼', 'W'],
    ['✖️', 'X'],
    ['❎', 'X'],
    ['❌', 'X'],
    ['🇽', 'X'],
    ['🇾', 'Y'],
    ['💤', 'Z'],
    ['🇿', 'Z'],
]);

export default class HangmanGame extends GameBase {
    private word = '';
    private guessed: string[] = [];
    private wrongs = 0;

    constructor() {
        super('hangman', false);
    }

    public newGame(interaction: DiscordInteraction, player2: DiscordUser | null, onGameEnd: (result: GameResult) => void): void {
        if (this.inGame)
            return;

        fetch('https://api.theturkey.dev/randomword').then(resp => resp.text())
            .then(word => {
                this.word = word.toUpperCase();
                this.guessed = [];
                this.wrongs = 0;

                super.newGame(interaction, player2, onGameEnd);
            }).catch(() => console.log('Failed to fetch random word!'));
    }

    private getBaseEmbed(): DiscordEmbed {
        return new DiscordEmbed()
            .setColor('#db9a00')
            .setTitle('Hangman')
            .setAuthor('Made By: TurkeyDev', 'https://site.theturkey.dev/images/turkey_avatar.png', 'https://www.youtube.com/watch?v=0G3gD4KJ59U')
            .setTimestamp();
    }

    protected getContent(): DiscordInteractionResponseMessageData {
        const resp = new DiscordInteractionResponseMessageData();
        resp.embeds = [this.getBaseEmbed()
            .setDescription(this.getDescription())
            .addField('Letters Guessed', this.guessed.length == 0 ? '\u200b' : this.guessed.join(' '))
            .addField('How To Play', 'React to this message using the emojis that look like letters (🅰️, 🇹, )')
            .setFooter(`Currently Playing: ${this.gameStarter.username}`)];
        return resp;
    }

    protected getGameOverContent(result: GameResult): DiscordInteractionResponseMessageData {
        const resp = new DiscordInteractionResponseMessageData();
        resp.embeds = [this.getBaseEmbed().setDescription(`${this.getWinnerText(result)}\n\nThe Word was:\n${this.word}\n\n${this.getDescription()}`)];
        return resp;
    }

    private makeGuess(reaction: string) {
        if (reactions.has(reaction)) {
            const letter = reactions.get(reaction);
            if (letter === undefined)
                return;

            if (!this.guessed.includes(letter)) {
                this.guessed.push(letter);

                if (this.word.indexOf(letter) == -1) {
                    this.wrongs++;

                    if (this.wrongs == 5) {
                        this.gameOver({ result: ResultType.LOSER, name: this.gameStarter.username, score: this.word });
                        return;
                    }
                }
                else if (!this.word.split('').map(l => this.guessed.includes(l) ? l : '_').includes('_')) {
                    this.gameOver({ result: ResultType.WINNER, name: this.gameStarter.username, score: this.word });
                    return;
                }
            }
        }

        this.step(true);
    }

    private getDescription(): string {
        return '```'
            + '|‾‾‾‾‾‾|   \n|     '
            + (this.wrongs > 0 ? '🎩' : ' ')
            + '   \n|     '
            + (this.wrongs > 1 ? '😟' : ' ')
            + '   \n|     '
            + (this.wrongs > 2 ? '👕' : ' ')
            + '   \n|     '
            + (this.wrongs > 3 ? '🩳' : ' ')
            + '   \n|    '
            + (this.wrongs > 4 ? '👞👞' : ' ')
            + '   \n|     \n|__________\n\n'
            + this.word.split('').map(l => this.guessed.includes(l) ? l : '_').join(' ')
            + '```';
    }

    public onReaction(reaction: DiscordMessageReactionAdd): void {
        const reactName = reaction.emoji.name;
        if (reactName)
            this.makeGuess(reactName);
        else
            this.step(true);
    }

    public onInteraction(interaction: DiscordInteraction): void { }
}