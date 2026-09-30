import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Split large third-party libraries into their own long-cached chunks so
    // the main bundle stays small and a dependency bump only busts its own
    // chunk. (exceljs is already loaded on demand via dynamic import.)
    // Main/vendor chunks stay under 500 kB after the splits above. exceljs is
    // fetched only for spreadsheet export (~940 kB), so the reporter limit sits
    // just above that on-demand chunk.
    chunkSizeWarningLimit: 960,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('exceljs')) return 'exceljs'
          if (/[\\/]node_modules[\\/](recharts|d3-|victory-|internmap|lodash)[\\/]/.test(id) || id.includes('recharts')) return 'charts'
          if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/]node_modules[\\/](@mui|@emotion)[\\/]/.test(id)) return 'mui'
          if (id.includes('@radix-ui')) return 'radix'
          if (/[\\/]node_modules[\\/](@supabase)[\\/]/.test(id)) return 'supabase'
          if (/[\\/]node_modules[\\/](@trpc|zod)[\\/]/.test(id)) return 'trpc'
          if (id.includes('lucide-react')) return 'icons'
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react-vendor'
        },
      },
    },
  },
})
