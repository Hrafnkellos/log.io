import chokidar from 'chokidar'
import Tail from 'tail'
import fs from 'fs'
import { Socket } from 'net'
import { promisify } from 'util'
import {
  FileInputConfig,
  FileSizeMap,
  InputConfig,
  WatcherOptions,
} from './types'

const openAsync = promisify(fs.open)
const readAsync = promisify(fs.read)
const statAsync = promisify(fs.stat)

const fds: {[filePath: string]: number} = {}

/**
 * Reads new lines from file on disk and sends them to the server
 */
async function sendNewMessages(
  client: Socket,
  streamName: string,
  sourceName: string,
  filePath: string,
  newSize: number,
  oldSize: number,
): Promise<void> {
  let fd = fds[filePath]
  if (!fd) {
    fd = await openAsync(filePath, 'r')
    fds[filePath] = fd
  }
  const offset = Math.max(newSize - oldSize, 0)
  const readBuffer: any = Buffer.alloc(offset)
  await readAsync(fd, readBuffer, 0, offset, oldSize)
  const messages = readBuffer.toString().split('\r\n').filter((msg:any) => !!msg.trim())
  messages.forEach((message:any) => {
    client.write(`+msg|${streamName}|${sourceName}|${message}\0`)
  })
}

export { sendNewMessages }

/**
 * Sends an input registration to server
 */
async function sendInput(
  client: Socket,
  input: FileInputConfig,
): Promise<void> {
  client.write(`+input|${input.stream}|${input.source}\0`)
}

/**
 * Initializes file watcher for the provided path
 */
async function startFileWatcher(
  client: Socket,
  streamName: string,
  sourceName: string,
  inputPath: string,
  watcherOptions: WatcherOptions,
): Promise<void> {

  var options= {
    separator: /[\r]{0,1}\n/, 
    fromBeginning: false, 
    fsWatchOptions: watcherOptions, 
    follow: true, 
    logger: console
  }

  const watcher = chokidar.watch(inputPath, watcherOptions)
  const tails = new Map();

  watcher
    .on("add", (filePath) => {
      console.log(`[${streamName}][${sourceName}] Watching: ${filePath}`)

      console.log(`New log file detected: ${filePath}`);
      const tail = new Tail.Tail(filePath, {
        useWatchFile: true,
        follow: true,
        fromBeginning: false,
      });

      tail.on("line", (line) => {
        console.log(`[${filePath}] ${line}`)
        client.write(`+msg|${streamName}|${sourceName}|${line}\0`)
      });

      tail.on("error", (err) => console.error(`[${filePath}] error:`, err));

      tails.set(filePath, tail);
    })
    .on("unlink", (filePath) => {
      console.log(`File removed: ${filePath}`);
      const tail = tails.get(filePath);
      if (tail) {
        tail.unwatch();
        tails.delete(filePath);
      }
    });

    function stopAllTails() {
      console.log("Stopping all tails...");
      for (const tail of tails.values()) tail.unwatch();
    }

    process.on("SIGINT", () => {
      console.log("\nCaught SIGINT (Ctrl+C). Cleaning up...");
      stopAllTails();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      console.log("\nCaught SIGTERM (system shutdown). Cleaning up...");
      stopAllTails();
      process.exit(0);
    });
}


/**
 * Async sleep helper
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Start file input process
 */
async function main(config: InputConfig): Promise<void> {
  const { messageServer, inputs } = config
  const serverStr = `${messageServer.host}:${messageServer.port}`
  const client = new Socket()
  let lastConnectionAttempt = new Date().getTime()
  // Register new inputs w/ server
  client.on('connect', async () => {
    // eslint-disable-next-line no-console
    console.log(`Connected to server: ${serverStr}`)
    await Promise.all(inputs.map(async (input) => {
      sendInput(client, input)
    }))
  })
  // Reconnect to server if an error occurs while sending a message
  client.on('error', async () => {
    const currTime = new Date().getTime()
    if (currTime - lastConnectionAttempt > 5000) {
      lastConnectionAttempt = new Date().getTime()
      // eslint-disable-next-line no-console
      console.error(`Unable to connect to server (${serverStr}), retrying...`)
      await sleep(5000)
      client.connect(messageServer.port, messageServer.host)
    }
  })
  // Connect to server & start watching files for changes
  client.connect(messageServer.port, messageServer.host)
  await Promise.all(inputs.map(async (input) => (
    startFileWatcher(
      client,
      input.stream,
      input.source,
      input.config.path,
      input.config.watcherOptions || {},
    )
  )))
}

export default main