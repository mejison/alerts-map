import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const commands = [
  ['Node', process.execPath, ['--version']],
  ['Xcode', 'xcodebuild', ['-version']],
  ['Java', 'java', ['-version']],
  ['Android SDK', 'adb', ['version']],
];
for (const [label, command, args] of commands) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  console.log(`${label}: ${result.status === 0 ? (result.stdout || result.stderr).trim().split('\n')[0] : 'not installed / not selected'}`);
}
for (const directory of ['ios/App/App.xcodeproj', 'android/gradlew', 'dist-mobile/index.html']) {
  console.log(`${directory}: ${existsSync(directory) ? 'ready' : 'missing'}`);
}
console.log('Native push setup and publishing: docs/MOBILE.md');
