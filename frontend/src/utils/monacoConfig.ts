/**
 * Monaco Editor Configuration for ApkRtool IDE
 * - Smali Language Tokenizer (Monarch)
 * - Multiple Themes (VS Dark, One Dark Pro, Dracula, Monokai, GitHub Dark, Nord, Cyberpunk, VS Light)
 */

export interface ThemeOption {
  id: string;
  name: string;
  base: 'vs-dark' | 'vs';
  bg: string;
  fg: string;
  accent: string;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  { id: 'vs-dark', name: 'VS Code Dark', base: 'vs-dark', bg: '#1e1e1e', fg: '#d4d4d4', accent: '#007acc' },
  { id: 'one-dark-pro', name: 'One Dark Pro', base: 'vs-dark', bg: '#282c34', fg: '#abb2bf', accent: '#61afef' },
  { id: 'dracula', name: 'Dracula Official', base: 'vs-dark', bg: '#282a36', fg: '#f8f8f2', accent: '#bd93f9' },
  { id: 'monokai', name: 'Monokai Pro', base: 'vs-dark', bg: '#272822', fg: '#f8f8f2', accent: '#a6e22e' },
  { id: 'github-dark', name: 'GitHub Dark', base: 'vs-dark', bg: '#0d1117', fg: '#c9d1d9', accent: '#58a6ff' },
  { id: 'nord', name: 'Nord Frost', base: 'vs-dark', bg: '#2e3440', fg: '#d8dee9', accent: '#88c0d0' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', base: 'vs-dark', bg: '#120f26', fg: '#05d9e8', accent: '#ff2a6d' },
  { id: 'solarized-dark', name: 'Solarized Dark', base: 'vs-dark', bg: '#002b36', fg: '#839496', accent: '#268bd2' },
  { id: 'vs-light', name: 'VS Code Light', base: 'vs', bg: '#ffffff', fg: '#000000', accent: '#007acc' },
];

let isInitialized = false;

export function setupMonacoEnvironment(monaco: any) {
  if (isInitialized || !monaco) return;
  isInitialized = true;

  // 1. Register Smali Language
  monaco.languages.register({ id: 'smali', extensions: ['.smali'] });

  monaco.languages.setLanguageConfiguration('smali', {
    comments: {
      lineComment: '#',
    },
    brackets: [
      ['{', '}'],
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  monaco.languages.setMonarchTokensProvider('smali', {
    defaultToken: '',
    tokenPostfix: '.smali',

    keywords: [
      'public', 'private', 'protected', 'static', 'final', 'synchronized',
      'bridge', 'varargs', 'native', 'abstract', 'strictfp', 'synthetic',
      'constructor', 'declared-synchronized', 'interface', 'enum', 'annotation',
      'system', 'build', 'runtime'
    ],

    directives: [
      '.class', '.super', '.implements', '.source', '.field', '.method',
      '.end', '.annotation', '.subannotation', '.registers', '.locals',
      '.parameter', '.prologue', '.line', '.restart', '.local', '.catch',
      '.catchall', '.packed-switch', '.sparse-switch', '.array-data', '.enum'
    ],

    opcodes: [
      'nop', 'move', 'move/from16', 'move/16', 'move-wide', 'move-wide/from16', 'move-wide/16',
      'move-object', 'move-object/from16', 'move-object/16', 'move-result', 'move-result-wide',
      'move-result-object', 'move-exception', 'return-void', 'return', 'return-wide', 'return-object',
      'const/4', 'const/16', 'const', 'const/high16', 'const-wide/16', 'const-wide/32', 'const-wide',
      'const-wide/high16', 'const-string', 'const-string/jumbo', 'const-class', 'monitor-enter',
      'monitor-exit', 'check-cast', 'instance-of', 'array-length', 'new-instance', 'new-array',
      'filled-new-array', 'filled-new-array/range', 'fill-array-data', 'throw', 'goto', 'goto/16',
      'goto/32', 'packed-switch', 'sparse-switch', 'cmpl-float', 'cmpg-float', 'cmpl-double',
      'cmpg-double', 'cmp-long', 'if-eq', 'if-ne', 'if-lt', 'if-ge', 'if-gt', 'if-le', 'if-eqz',
      'if-nez', 'if-ltz', 'if-gez', 'if-gtz', 'if-lez', 'aget', 'aget-wide', 'aget-object',
      'aget-boolean', 'aget-byte', 'aget-char', 'aget-short', 'aput', 'aput-wide', 'aput-object',
      'aput-boolean', 'aput-byte', 'aput-char', 'aput-short', 'iget', 'iget-wide', 'iget-object',
      'iget-boolean', 'iget-byte', 'iget-char', 'iget-short', 'iput', 'iput-wide', 'iput-object',
      'iput-boolean', 'iput-byte', 'iput-char', 'iput-short', 'sget', 'sget-wide', 'sget-object',
      'sget-boolean', 'sget-byte', 'sget-char', 'sget-short', 'sput', 'sput-wide', 'sput-object',
      'sput-boolean', 'sput-byte', 'sput-char', 'sput-short', 'invoke-virtual', 'invoke-super',
      'invoke-direct', 'invoke-static', 'invoke-interface', 'invoke-virtual/range', 'invoke-super/range',
      'invoke-direct/range', 'invoke-static/range', 'invoke-interface/range', 'invoke-polymorphic',
      'invoke-custom', 'neg-int', 'not-int', 'neg-long', 'not-long', 'neg-float', 'neg-double',
      'int-to-long', 'int-to-float', 'int-to-double', 'long-to-int', 'long-to-float', 'long-to-double',
      'float-to-int', 'float-to-long', 'float-to-double', 'double-to-int', 'double-to-long',
      'double-to-float', 'int-to-byte', 'int-to-char', 'int-to-short', 'add-int', 'sub-int',
      'mul-int', 'div-int', 'rem-int', 'and-int', 'or-int', 'xor-int', 'shl-int', 'shr-int',
      'ushr-int', 'add-long', 'sub-long', 'mul-long', 'div-long', 'rem-long', 'and-long',
      'or-long', 'xor-long', 'shl-long', 'shr-long', 'ushr-long', 'add-float', 'sub-float',
      'mul-float', 'div-float', 'rem-float', 'add-double', 'sub-double', 'mul-double',
      'div-double', 'rem-double', 'add-int/2addr', 'sub-int/2addr', 'mul-int/2addr',
      'div-int/2addr', 'rem-int/2addr', 'and-int/2addr', 'or-int/2addr', 'xor-int/2addr',
      'shl-int/2addr', 'shr-int/2addr', 'ushr-int/2addr', 'add-int/lit16', 'rsub-int',
      'mul-int/lit16', 'div-int/lit16', 'rem-int/lit16', 'and-int/lit16', 'or-int/lit16',
      'xor-int/lit16', 'add-int/lit8', 'rsub-int/lit8', 'mul-int/lit8', 'div-int/lit8',
      'rem-int/lit8', 'and-int/lit8', 'or-int/lit8', 'xor-int/lit8', 'shl-int/lit8',
      'shr-int/lit8', 'ushr-int/lit8'
    ],

    tokenizer: {
      root: [
        // Comments
        [/#.*$/, 'comment'],

        // Registers (v0, v1, p0, p1, etc.)
        [/\b[vp][0-9]+\b/, 'variable.parameter'],

        // Labels (:cond_0, :goto_1, etc.)
        [/:\w+/, 'tag'],

        // Directives (.class, .method, .line, etc.)
        [/\.[a-zA-Z_-]+/, {
          cases: {
            '@directives': 'keyword.control',
            '@default': 'keyword'
          }
        }],

        // Method invocation arrow and name (->onClick)
        [/->[a-zA-Z0-9_$<>]+/, 'entity.name.function'],

        // Type descriptors (Lcom/android/internal/R$id; or Ljava/lang/String;)
        [/L[a-zA-Z0-9_$/]+;/, 'type'],

        // Primitive types and arrays
        [/\b[ZBCSIJFDV]\b/, 'type.primitive'],
        [/\[+[ZBCSIJFDV]/, 'type.primitive'],
        [/\[+L[a-zA-Z0-9_$/]+;/, 'type'],

        // Strings
        [/"([^"\\]|\\.)*"/, 'string'],

        // Hex numbers and integer values
        [/0x[0-9a-fA-F]+[tbslL]?/, 'number.hex'],
        [/-?[0-9]+[tbslL]?/, 'number'],

        // Brackets & delimiters
        [/[{}()\[\]]/, '@brackets'],

        // Opcodes, modifiers and identifiers
        [/[a-zA-Z0-9_\-\/]+/, {
          cases: {
            '@opcodes': 'keyword.operator',
            '@keywords': 'keyword',
            '@default': 'identifier'
          }
        }]
      ]
    }
  });

  // 2. Define Themes
  // One Dark Pro
  monaco.editor.defineTheme('one-dark-pro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'c678dd', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '61afef' },
      { token: 'keyword', foreground: 'e5c07b' },
      { token: 'variable.parameter', foreground: 'e06c75', fontStyle: 'bold' },
      { token: 'tag', foreground: '98c379', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '61afef' },
      { token: 'type', foreground: '56b6c2' },
      { token: 'type.primitive', foreground: 'e5c07b' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'number.hex', foreground: 'd19a66' },
    ],
    colors: {
      'editor.background': '#282c34',
      'editor.foreground': '#abb2bf',
      'editorCursor.foreground': '#528bff',
      'editor.lineHighlightBackground': '#2c313a',
      'editorLineNumber.foreground': '#4b5263',
      'editorLineNumber.activeForeground': '#abb2bf',
      'editor.selectionBackground': '#3e4451',
    }
  });

  // Dracula Official
  monaco.editor.defineTheme('dracula', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'ff79c6', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '8be9fd' },
      { token: 'keyword', foreground: 'ffb86c' },
      { token: 'variable.parameter', foreground: '50fa7b', fontStyle: 'bold' },
      { token: 'tag', foreground: 'ffb86c', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '50fa7b' },
      { token: 'type', foreground: 'bd93f9' },
      { token: 'type.primitive', foreground: '8be9fd' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'number.hex', foreground: 'bd93f9' },
    ],
    colors: {
      'editor.background': '#282a36',
      'editor.foreground': '#f8f8f2',
      'editorCursor.foreground': '#aeafad',
      'editor.lineHighlightBackground': '#44475a75',
      'editorLineNumber.foreground': '#6272a4',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editor.selectionBackground': '#44475a',
    }
  });

  // Monokai Pro
  monaco.editor.defineTheme('monokai', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'f92672', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '66d9ef' },
      { token: 'keyword', foreground: 'fd971f' },
      { token: 'variable.parameter', foreground: 'fd971f', fontStyle: 'bold' },
      { token: 'tag', foreground: 'a6e22e', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: 'a6e22e' },
      { token: 'type', foreground: '66d9ef' },
      { token: 'type.primitive', foreground: 'a6e22e' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'number.hex', foreground: 'ae81ff' },
    ],
    colors: {
      'editor.background': '#272822',
      'editor.foreground': '#f8f8f2',
      'editorCursor.foreground': '#f8f8f0',
      'editor.lineHighlightBackground': '#3e3d32',
      'editorLineNumber.foreground': '#90908a',
      'editorLineNumber.activeForeground': '#f8f8f2',
      'editor.selectionBackground': '#49483e',
    }
  });

  // GitHub Dark
  monaco.editor.defineTheme('github-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'ff7b72', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '79c0ff' },
      { token: 'keyword', foreground: 'ffa657' },
      { token: 'variable.parameter', foreground: '79c0ff', fontStyle: 'bold' },
      { token: 'tag', foreground: '7ee787', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: 'd2a8ff' },
      { token: 'type', foreground: 'ffa657' },
      { token: 'type.primitive', foreground: '79c0ff' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'number.hex', foreground: '79c0ff' },
    ],
    colors: {
      'editor.background': '#0d1117',
      'editor.foreground': '#c9d1d9',
      'editorCursor.foreground': '#58a6ff',
      'editor.lineHighlightBackground': '#161b22',
      'editorLineNumber.foreground': '#484f58',
      'editorLineNumber.activeForeground': '#c9d1d9',
      'editor.selectionBackground': '#264f78',
    }
  });

  // Nord Frost
  monaco.editor.defineTheme('nord', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '616e88', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: '81a1c1', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '88c0d0' },
      { token: 'keyword', foreground: '81a1c1' },
      { token: 'variable.parameter', foreground: 'd08770', fontStyle: 'bold' },
      { token: 'tag', foreground: 'a3be8c', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '88c0d0' },
      { token: 'type', foreground: '8fbcbb' },
      { token: 'type.primitive', foreground: '81a1c1' },
      { token: 'string', foreground: 'a3be8c' },
      { token: 'number', foreground: 'b48ead' },
      { token: 'number.hex', foreground: 'b48ead' },
    ],
    colors: {
      'editor.background': '#2e3440',
      'editor.foreground': '#d8dee9',
      'editorCursor.foreground': '#d8dee9',
      'editor.lineHighlightBackground': '#3b4252',
      'editorLineNumber.foreground': '#4c566a',
      'editorLineNumber.activeForeground': '#d8dee9',
      'editor.selectionBackground': '#434c5e',
    }
  });

  // Cyberpunk Neon
  monaco.editor.defineTheme('cyberpunk', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5d558a', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'ff2a6d', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '05d9e8' },
      { token: 'keyword', foreground: 'fcee09' },
      { token: 'variable.parameter', foreground: 'ff6ac1', fontStyle: 'bold' },
      { token: 'tag', foreground: '05d9e8', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: 'fcee09' },
      { token: 'type', foreground: '00ff9f' },
      { token: 'type.primitive', foreground: '05d9e8' },
      { token: 'string', foreground: '00ff9f' },
      { token: 'number', foreground: 'ff2a6d' },
      { token: 'number.hex', foreground: 'ff2a6d' },
    ],
    colors: {
      'editor.background': '#120f26',
      'editor.foreground': '#e0e6ed',
      'editorCursor.foreground': '#05d9e8',
      'editor.lineHighlightBackground': '#1b163a',
      'editorLineNumber.foreground': '#5d558a',
      'editorLineNumber.activeForeground': '#05d9e8',
      'editor.selectionBackground': '#3a2e66',
    }
  });

  // Solarized Dark
  monaco.editor.defineTheme('solarized-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '586e75', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: '859900', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '268bd2' },
      { token: 'keyword', foreground: 'b58900' },
      { token: 'variable.parameter', foreground: 'cb4b16', fontStyle: 'bold' },
      { token: 'tag', foreground: '2aa198', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '268bd2' },
      { token: 'type', foreground: 'b58900' },
      { token: 'type.primitive', foreground: '2aa198' },
      { token: 'string', foreground: '2aa198' },
      { token: 'number', foreground: 'd33682' },
      { token: 'number.hex', foreground: 'd33682' },
    ],
    colors: {
      'editor.background': '#002b36',
      'editor.foreground': '#839496',
      'editorCursor.foreground': '#839496',
      'editor.lineHighlightBackground': '#073642',
      'editorLineNumber.foreground': '#586e75',
      'editorLineNumber.activeForeground': '#93a1a1',
      'editor.selectionBackground': '#073642',
    }
  });

  // VS Code Light
  monaco.editor.defineTheme('vs-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword.control', foreground: 'af00db', fontStyle: 'bold' },
      { token: 'keyword.operator', foreground: '001080' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'variable.parameter', foreground: 'a31515', fontStyle: 'bold' },
      { token: 'tag', foreground: '800000', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '795e26' },
      { token: 'type', foreground: '267f99' },
      { token: 'type.primitive', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'number.hex', foreground: '098658' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#f3f3f3',
      'editorLineNumber.foreground': '#237893',
      'editorLineNumber.activeForeground': '#000000',
      'editor.selectionBackground': '#add6ff',
    }
  });
}
