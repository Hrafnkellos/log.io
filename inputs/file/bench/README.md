This benchmark simulates appending log lines to a file and measures how quickly `sendNewMessages` reads and writes messages to a socket.

How to run

1. Install dev dependencies at project root (from `inputs/file`):

   npm install

2. Run the benchmark:

   npm run bench

What it measures

- messages: total messages written to the dummy socket
- bytes: total bytes written
- duration_ns: elapsed time in nanoseconds for the benchmark
- messages/sec and MB/sec are derived metrics

Notes

- The benchmark uses a simple in-memory DummySocket and `ts-node` to run TypeScript directly.
- For more realistic testing, replace DummySocket with a real TCP server or run multiple concurrent writers.
