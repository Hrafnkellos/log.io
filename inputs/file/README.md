# Log.io - File Input

===================

Powered by [node.js](http://nodejs.org) + [socket.io](http://socket.io)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache2.0)
[![Version](https://img.shields.io/badge/node-%3E%3D%2012-brightgreen)](https://nodejs.org/)
[![Node](https://img.shields.io/npm/v/log.io)](https://www.npmjs.com/package/log.io)

## How does it work?

A **file input** watches log files for changes, sends new messages to the **server** via TCP, which broadcasts to **browsers** via socket.io.

## Terminology

**Stream** - A logical designation for a group of messages that relate to one another.  Examples include an application name, a topic name, or a backend service name.

**Source** - A physical designation for a group of messages that originate from the same source.  Examples include a server name, a service provider name, or a filename.

**Input** - A (stream, source) pair.

While originally designed to represent backend service logs spread across multiple servers, the stream/source abstraction is intentionally open-ended to allow users to define a system topology for their specific use case.

## Install & run file input

Install via npm

```sh
npm install -g log.io-file-input
```

Configure file input (see example below)

```sh
nano ~/.log.io/inputs/file.json
```

Run file input

```sh
log.io-file-input
```

## File input configuration

Inputs are created by associating file paths with stream and source names in a configuration file.  By default, the file input looks for configuration in `~/.log.io/inputs/file.json`, and can be overridden with the environment variable `LOGIO_FILE_INPUT_CONFIG_PATH`.

```sh
export LOGIO_FILE_INPUT_CONFIG_PATH="/home/hrafnkell/git/log.io/inputs/file.json"
```

Input paths can be a file path, directory path or a [glob](https://en.wikipedia.org/wiki/Glob_(programming)).  Additionally, watcher options can be provided for more fine-grained control over file watching mechanics and performance. See the [chokidar](https://github.com/paulmillr/chokidar) documentation for more information.

Sample configuration file:

```json
{
  "messageServer": {
    "host": "127.0.0.1",
    "port": 6689
  },
  "inputs": [
    {
      "source": "server1",
      "stream": "app1",
      "config": {
        "path": "log.io-demo/file-generator/app1-server1.log"
      }
    },
    {
      "source": "server2",
      "stream": "system-logs",
      "config": {
        "path": "/var/log/**/*.log",
        "watcherOptions": {
          "ignored": "*.txt",
          "depth": 99,
        }
      }
    }
  ]
}

```

## Server TCP interface

The file input connects to the server via TCP, and writes properly formatted strings to the socket.  Custom inputs can send messages to the server using the following commands, each of which ends with a null character:

Send a log message

```sh
+msg|streamName1|sourceName1|this is log message\0
```

Register a new input

```sh
+input|streamName1|sourceName1\0
```

Remove an existing input

```sh
-input|streamName1|sourceName1\0
```

```sh
npm run bench -- --file "/home/hrafnkell/git/log.io/inputs/demo.log"
```

## Docker

This package includes a `Dockerfile` (multi-stage) to build and run the file input as a container.

Build the image:

```sh
cd inputs/file
docker build -t logio-file-input:local .
```

Run the container (mount a config file):

```sh
docker run --rm -e LOGIO_FILE_INPUT_CONFIG_PATH=/config/file.json -v /host/config:/config logio-file-input:local
```

Short command (mount the repository `inputs/file.json` into the container):

```sh
# from `inputs/file` directory
docker run --rm -it \
    --add-host host.docker.internal:host-gateway \
  -v "$(pwd)/../file.json:/config/file.json:ro" \
  -e LOGIO_FILE_INPUT_CONFIG_PATH=/config/file.json \
    -v $(pwd)/..:/logs:ro \
  logio-file-input:local
```

Run detached (background) and view logs:

```sh
# run detached and name the container
docker run -d --name logio-file-input \
    --add-host host.docker.internal:host-gateway \
  -v "$(pwd)/../file.json:/config/file.json:ro" \
  -e LOGIO_FILE_INPUT_CONFIG_PATH=/config/file.json \
  -v $(pwd)/..:/logs:ro \
  logio-file-input:local

# view logs
docker logs -f logio-file-input

# stop
docker stop logio-file-input
```

Notes:

- The builder stage installs devDependencies and runs the project build. The runtime stage copies the build artifacts and production dependencies from the builder to keep the image small.

- If your host doesn't have Docker or the Docker daemon isn't running, the build will fail locally. In that case build the project locally with `npm run build` and run `node lib/index.js`.
