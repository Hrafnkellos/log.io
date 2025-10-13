import fs from 'fs'
import os from 'os'
import path from 'path'
import { Socket } from 'net'
import { promisify } from 'util'
import { sendNewMessages } from '../src/input'

const writeFile = promisify(fs.writeFile)
const appendFile = promisify(fs.appendFile)
const stat = promisify(fs.stat)

class DummySocket extends (Socket as any) {
  written: Buffer[] = []
  write(chunk: any): boolean {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    this.written.push(buf)
    return true
  }
}

async function makeTempFile(initial: string) {
  const filePath = path.join(os.tmpdir(), `logio-bench-${Date.now()}-${Math.random().toString(36).slice(2)}.log`)
  await writeFile(filePath, initial, { encoding: 'utf8' })
  return filePath
}

async function bench() {
  const client = new DummySocket()
  const stream = 'bench'
  const source = 'bench-source'

  const linesPerAppend = 100
  const line = 'This is a sample log line for benchmarking purposes.'

  // Allow targeting a specific file for a live test via CLI or env var
  // Usage: BENCH_TARGET_FILE=/path/to/file npm run bench
  const targetFile = process.env.BENCH_TARGET_FILE || (() => {
    const idx = process.argv.indexOf('--file')
    return idx >= 0 && process.argv.length > idx + 1 ? process.argv[idx + 1] : undefined
  })()

  const filePath = targetFile || (await makeTempFile(''))
  let oldSize = 0

  const iterations = 10
  let totalMessages = 0
  let totalBytes = 0
  // Global incremental id for every line written by this benchmark
  let lineId = 0
  const start = process.hrtime.bigint()

  for (let i = 0; i < iterations; i += 1) {
    // Tag each line with a unique incremental ID.
    const chunk = Array.from({ length: linesPerAppend }, () => `id=${++lineId}|${line}`).join('\r\n') + '\r\n'
    // Append to the target file (live) or temp file (synthetic)
    await appendFile(filePath, chunk, { encoding: 'utf8' })
    const newSize = (await stat(filePath)).size
    if (!targetFile) {
      // Default synthetic bench: measure with metrics
      await sendNewMessages(client as unknown as Socket, stream, source, filePath, newSize, oldSize)
      // accumulate from DummySocket
      const writtenBytes = client.written.reduce((acc, b) => acc + b.length, 0)
      totalBytes = writtenBytes
      totalMessages = client.written.length
    } else {
      // Live-target mode: only write to the file. Count bytes/messages based on what we appended.
      totalMessages += linesPerAppend
      totalBytes += Buffer.byteLength(chunk, 'utf8')
    }
    oldSize = newSize
  }

  const durationNs = Number(process.hrtime.bigint() - start)
  console.log('--- BENCH RESULTS ---')
  console.log(`iterations=${iterations} linesPerAppend=${linesPerAppend}`)
  console.log(`messages=${totalMessages} bytes=${totalBytes} duration_ns=${durationNs}`)
  console.log(`messages/sec=${(totalMessages / (durationNs / 1e9)).toFixed(2)}`)
  console.log(`MB/sec=${(totalBytes / (durationNs / 1e9) / (1024 * 1024)).toFixed(2)}`)
}

bench().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
})
