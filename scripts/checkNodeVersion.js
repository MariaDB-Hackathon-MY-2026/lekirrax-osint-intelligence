const raw = process.versions?.node || '0.0.0';
const [maj, min, pat] = raw.split('.').map((v) => Number.parseInt(v, 10));

const major = Number.isFinite(maj) ? maj : 0;
const minor = Number.isFinite(min) ? min : 0;
const patch = Number.isFinite(pat) ? pat : 0;

if (major < 20) {
  process.stderr.write(
    [
      `LekirraX requires Node.js >= 20.`,
      `Detected Node.js ${major}.${minor}.${patch}.`,
      ``,
      `Reason: some dependencies rely on Web APIs (like global File) that are not available in Node 18, which can crash at startup.`,
      ``,
      `Fix: install Node.js 20+ (LTS) and run "npm install" again, then "npm start".`,
      ``
    ].join('\n')
  );
  process.exit(1);
}

