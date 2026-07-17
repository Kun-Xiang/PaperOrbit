import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmod, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const localStateDirectory = resolve(process.cwd(), ".paperorbit");
const localSessionSecretPath = join(
  localStateDirectory,
  "local-session-secret",
);

async function resolveLocalSessionSecret() {
  const configuredSecret = process.env.PAPER_ORBIT_SESSION_SECRET?.trim();
  if (configuredSecret && configuredSecret.length >= 32) {
    return configuredSecret;
  }

  await mkdir(localStateDirectory, { recursive: true, mode: 0o700 });
  const stateDirectoryStats = await lstat(localStateDirectory);
  if (
    stateDirectoryStats.isSymbolicLink()
    || !stateDirectoryStats.isDirectory()
  ) {
    throw new Error("Paper Orbit local state path must be a real directory");
  }
  await chmod(localStateDirectory, 0o700);

  try {
    const storedSecretStats = await lstat(localSessionSecretPath);
    if (storedSecretStats.isSymbolicLink() || !storedSecretStats.isFile()) {
      throw new Error("Paper Orbit local session secret must be a real file");
    }
    const storedSecret = (await readFile(localSessionSecretPath, "utf8")).trim();
    if (storedSecret.length >= 32) {
      await chmod(localSessionSecretPath, 0o600);
      return storedSecret;
    }
    throw new Error("Paper Orbit local session secret is invalid");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const generatedSecret = randomBytes(32).toString("hex");
  await writeFile(localSessionSecretPath, `${generatedSecret}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(localSessionSecretPath, 0o600);
  return generatedSecret;
}

const sessionSecret = await resolveLocalSessionSecret();
const child = spawn(
  npmCommand,
  [
    "run",
    "dev",
    "--",
    ...process.argv.slice(2),
    // vinext passes --hostname as inline Vite config, which beats
    // vite.config.ts. Its "localhost" default may bind [::1] only, making
    // http://127.0.0.1:3000 refuse connections; an explicit IPv4 loopback
    // bind serves 127.0.0.1 directly and localhost via browser fallback.
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
    "--strictPort",
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PAPER_ORBIT_LOCAL_MODE: "1",
      PAPER_ORBIT_LOCAL_USER_EMAIL:
        process.env.PAPER_ORBIT_LOCAL_USER_EMAIL?.trim()
        || "local@paperorbit.dev",
      PAPER_ORBIT_LOCAL_USER_NAME:
        process.env.PAPER_ORBIT_LOCAL_USER_NAME?.trim()
        || "Local PaperOrbit User",
      PAPER_ORBIT_SESSION_SECRET: sessionSecret,
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Unable to start PaperOrbit local mode: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
