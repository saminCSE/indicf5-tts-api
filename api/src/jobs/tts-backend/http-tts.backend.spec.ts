import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { HttpTtsBackend } from './http-tts.backend';

function startStub(
  handler: (body: string) => { status: number; body: Buffer; delayMs?: number },
): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const { status, body: resBody, delayMs } = handler(body);
        setTimeout(() => {
          res.writeHead(status, { 'Content-Type': 'audio/wav' });
          res.end(resBody);
        }, delayMs ?? 0);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('HttpTtsBackend', () => {
  let server: Server | undefined;

  afterEach((done) => {
    if (server) {
      server.close(() => done());
      server = undefined;
    } else {
      done();
    }
  });

  it('POSTs text and returns the WAV bytes as a Buffer', async () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(8)]);
    let received = '';
    const stub = await startStub((body) => {
      received = body;
      return { status: 200, body: wav };
    });
    server = stub.server;

    const backend = new HttpTtsBackend(stub.url, 5000);
    const result = await backend.synthesize('আমার সোনার বাংলা');

    expect(result.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(JSON.parse(received)).toEqual({ text: 'আমার সোনার বাংলা' });
  });

  it('throws on a non-200 response', async () => {
    const stub = await startStub(() => ({
      status: 500,
      body: Buffer.from('{"detail":"boom"}'),
    }));
    server = stub.server;

    const backend = new HttpTtsBackend(stub.url, 5000);
    await expect(backend.synthesize('টেক্সট')).rejects.toThrow(/500/);
  });

  it('aborts when the server exceeds the timeout', async () => {
    const stub = await startStub(() => ({
      status: 200,
      body: Buffer.from('RIFF'),
      delayMs: 2000,
    }));
    server = stub.server;

    const backend = new HttpTtsBackend(stub.url, 200);
    await expect(backend.synthesize('টেক্সট')).rejects.toThrow();
  }, 10000);
});
