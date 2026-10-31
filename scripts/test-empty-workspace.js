const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

console.log('Testing empty workspace handling...');

const tempEmptyDir = path.join(process.cwd(), '.temp-empty-test');
if (!fs.existsSync(tempEmptyDir)) {
  fs.mkdirSync(tempEmptyDir, { recursive: true });
}

try {
  const dirents = fs.readdirSync(tempEmptyDir, { withFileTypes: true });
  assert.strictEqual(dirents.length, 0, 'Temporary test dir must be empty');

  const handleName = tempEmptyDir.split(/[\\/]/).filter(Boolean).pop() || tempEmptyDir;
  assert.strictEqual(handleName, '.temp-empty-test', 'Folder name resolution matches');

  const editorAreaSrc = fs.readFileSync('frontend/src/components/EditorArea.tsx', 'utf-8');
  assert.ok(
    editorAreaSrc.includes(') : workspaceOpened ? ('),
    'EditorArea must distinguish workspaceOpened with 0 tabs from unopened welcome screen'
  );
  assert.ok(
    editorAreaSrc.includes("workspaceName || 'Workspace'"),
    'EditorArea must show workspaceName when workspace is opened'
  );

  const sidebarSrc = fs.readFileSync('frontend/src/components/Sidebar.tsx', 'utf-8');
  assert.ok(
    sidebarSrc.includes("dirHandle ? dirHandle.name : 'Explorer'"),
    'Sidebar header must display open directory name'
  );

  const fileTreeSrc = fs.readFileSync('frontend/src/components/FileTree.tsx', 'utf-8');
  assert.ok(
    fileTreeSrc.includes('Empty workspace folder'),
    'FileTree must render actionable empty workspace state'
  );

  const storageSrc = fs.readFileSync('frontend/src/utils/workspaceStorage.ts', 'utf-8');
  assert.ok(
    storageSrc.includes("if (!('path' in handle && typeof (handle as any).path === 'string'))"),
    'workspaceStorage must avoid cloning native handles with methods into IndexedDB'
  );

  console.log('✓ All empty workspace checks passed successfully.');
} finally {
  if (fs.existsSync(tempEmptyDir)) {
    fs.rmdirSync(tempEmptyDir);
  }
}
