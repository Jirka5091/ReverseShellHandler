
# ReverseShellHandler

![ReverseShellHandler](https://img.shields.io/badge/ReverseShellHandler-v1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

ReverseShellHandler is a Node.js-based tool for managing reverse shell connections, allowing you to handle multiple sessions efficiently. It provides a convenient command-line interface to manage and interact with reverse shells, making it a valuable asset for penetration testers and security professionals.

## Features

- 📝 List active sessions
- 🔍 Select a session by ID
- ❌ Terminate a session by ID
- 🚀 Background a session
- 📂 Download files from the target system

## Installation

To install the required dependencies, run the following commands:

```bash
git clone https://github.com/Jirka5091/ReverseShellHandler
cd ReverseShellHandler
npm install
```

## Usage

To start the ReverseShellHandler, use the following command:

```bash
node server.mjs <port> [bindaddr]
```

### Example

```bash
node server.mjs 8080 0.0.0.0
```

## Commands

```
- ls                  List active sessions
- ls -a               List all sessions
- session -i <ID>     Select a session by ID
- session -k <ID>     Terminate a session by ID
- background          Send the current session to the background
- help                Display help message
- exit                End process
- download <path>     Download file from the target system (works only in a session)
```

## Screenshots

![Session List](https://github.com/Jirka5091/ReverseShellHandler/blob/main/Sessions.png)
*Listing active sessions.*

![Session Selected](https://github.com/Jirka5091/ReverseShellHandler/blob/main/Commands.png)
*Session selected and commands being executed.*

## Disclaimer

This tool is intended for educational purposes and legitimate penetration testing only. Unauthorized use of this tool to compromise computer systems, networks, or any other systems without permission is illegal and unethical. The author is not responsible for any misuse of this tool.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

[crash_byte](https://github.com/Jirka5091)
