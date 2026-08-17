import http from 'http';

// Talks to the host's Docker daemon over the socket mounted into the test container
// (-v /var/run/docker.sock:/var/run/docker.sock in run-all-tests.sh) — no docker CLI
// needed inside the test image, just this one raw HTTP call.
const SOCKET_PATH = '/var/run/docker.sock';

function dockerRequest(method: string, path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCKET_PATH, path, method }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('error', reject);
    req.end();
  });
}

// 204 = action performed, 304 = container was already in that state — both are fine here,
// since every call site treats stop/start as an idempotent "make sure it's like this" op
// (e.g. afterEach always tries to start the container even if the test already did).
async function expectOk(method: string, path: string): Promise<void> {
  const status = await dockerRequest(method, path);
  if (status !== 204 && status !== 304) {
    throw new Error(`Docker API ${method} ${path} -> unexpected status ${status}`);
  }
}

export const stopContainer = (name: string): Promise<void> => expectOk('POST', `/containers/${name}/stop?t=5`);
export const startContainer = (name: string): Promise<void> => expectOk('POST', `/containers/${name}/start`);
