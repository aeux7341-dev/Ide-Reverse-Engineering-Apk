const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Filesystem & Rename Robustness...');

const tmpDir = path.join(__dirname, '..', 'temp', 'test-fs-suite');
if (fs.existsSync(tmpDir)) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
fs.mkdirSync(tmpDir, { recursive: true });

// 1. Test directory rename
const testSubDir = path.join(tmpDir, 'subfolder');
fs.mkdirSync(testSubDir, { recursive: true });
const testFile = path.join(testSubDir, 'sample.txt');
fs.writeFileSync(testFile, 'Hello ApkRtool IDE', 'utf8');

const renamedSubDir = path.join(tmpDir, 'renamed-folder');
fs.renameSync(testSubDir, renamedSubDir);

assert.strictEqual(fs.existsSync(testSubDir), false, 'Old folder path should not exist after rename');
assert.strictEqual(fs.existsSync(renamedSubDir), true, 'New folder path should exist after rename');
assert.strictEqual(
  fs.readFileSync(path.join(renamedSubDir, 'sample.txt'), 'utf8'),
  'Hello ApkRtool IDE',
  'File inside renamed folder must be preserved intact'
);

// Cleanup
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('✓ Filesystem and folder rename suite passed.');
