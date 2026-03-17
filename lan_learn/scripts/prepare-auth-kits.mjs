import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const rootDir = process.cwd();

const packages = [
  "atozas-auth-kit-express",
  "atozas-react-auth-kit",
];

function run(command, description) {
  try {
    console.log(`[auth-kit] ${description}`);
    execSync(command, {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch (error) {
    throw new Error(`${description} failed: ${error.message}`);
  }
}

function ensureCjsEntry(pkgDir) {
  const distDir = path.join(pkgDir, "dist");
  const jsEntry = path.join(distDir, "index.js");
  const cjsEntry = path.join(distDir, "index.cjs");

  if (!fs.existsSync(jsEntry)) {
    return;
  }

  if (!fs.existsSync(cjsEntry)) {
    fs.copyFileSync(jsEntry, cjsEntry);
    console.log(`[auth-kit] Created ${path.relative(rootDir, cjsEntry)}`);
  }
}

function shouldBuild(pkgDir) {
  const distDir = path.join(pkgDir, "dist");
  const dtsEntry = path.join(distDir, "index.d.ts");
  return !fs.existsSync(distDir) || !fs.existsSync(dtsEntry);
}

for (const pkgName of packages) {
  const pkgDir = path.join(rootDir, "node_modules", pkgName);

  if (!fs.existsSync(pkgDir)) {
    console.warn(`[auth-kit] Skipping ${pkgName} (not installed)`);
    continue;
  }

  if (shouldBuild(pkgDir)) {
    const buildCommand = `${npmCmd} explore ${pkgName} -- ${npmCmd} run build`;
    try {
      run(buildCommand, `Building ${pkgName}`);
    } catch (_initialBuildError) {
      const bootstrapCommand = `${npmCmd} explore ${pkgName} -- ${npmCmd} i --no-save typescript tsup rimraf`;
      run(bootstrapCommand, `Installing local build tools for ${pkgName}`);
      run(buildCommand, `Rebuilding ${pkgName}`);
    }
  }

  ensureCjsEntry(pkgDir);
}
