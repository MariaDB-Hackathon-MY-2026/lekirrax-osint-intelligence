const raw = process.versions?.node || '0.0.0';
const [maj, min, pat] = raw.split('.').map((v) => Number.parseInt(v, 10));

const major = Number.isFinite(maj) ? maj : 0;
const minor = Number.isFinite(min) ? min : 0;
const patch = Number.isFinite(pat) ? pat : 0;

const requiredMajor = 22;
const requiredMinor = 12;

const tooOld =
  major < requiredMajor || (major === requiredMajor && minor < requiredMinor);

if (tooOld) {
  process.stderr.write(
    [
      `LekirraX requires Node.js >= 22.12.0.`,
      `Detected Node.js ${major}.${minor}.${patch}.`,
      ``,
      `Reason: frontend tooling (Vite) and some dependencies require modern Web APIs and ESM behavior.`,
      ``,
      `Fix: install Node.js 22 LTS (recommended) and run "npm install" again, then "npm start".`,
      ``
    ].join('\n')
  );
  process.exit(1);
}
