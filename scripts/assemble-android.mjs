import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const androidDirectory = fileURLToPath(new URL('../android/', import.meta.url));
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const result = spawnSync(wrapper, ['assembleDebug'], {
  cwd: androidDirectory,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
