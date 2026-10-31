/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VS Code / ApkRtool IDE Design System Palette
        vsc: {
          main: '#1F1F1F',       // #1F1F1F warna utama
          secondary: '#181818',  // #181818 warna kedua
          card: '#252526',       // card & list background
          cardHover: '#2A2D2E',  // card hover
          border: '#2B2B2B',     // subtle border
          borderLight: '#383838',// lighter border
          icon: '#696969',       // #696969 warna icon atau text
          textMuted: '#696969',  // #696969 text muted
          textMid: '#999999',    // mid-gray text
          textActive: '#CCCCCC', // default editor text
          textBright: '#FFFFFF', // bright white text
          btn: '#0078D4',        // #0078D4 untuk button
          btnHover: '#1084d8',   // button hover
          btnText: '#FFFFFF',    // #FFFFFF untuk text didalam button
          btnSecondary: '#2B2B2B',
          btnSecondaryHover: '#373737',
        },
        editor: {
          bg: '#1F1F1F',
          sidebar: '#181818',
          navbar: '#181818',
          activeTab: '#1F1F1F',
          inactiveTab: '#181818',
          border: '#2B2B2B',
          textMuted: '#696969',
          textActive: '#CCCCCC',
          accent: '#0078D4',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
