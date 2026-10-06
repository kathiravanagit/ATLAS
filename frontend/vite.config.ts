import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'motion/react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Rolldown (vite 8) requires function form; same chunk grouping as before.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          const segs = id.split('node_modules/')[1].split('/');
          const pkg = segs[0].startsWith('@') ? `${segs[0]}/${segs[1]}` : segs[0];
          if (pkg === 'react' || pkg === 'react-dom' || pkg === 'react-router-dom') return 'react';
          if (pkg === 'motion') return 'motion';
          if (pkg === 'recharts') return 'charts';
          if (pkg === 'leaflet' || pkg === 'react-leaflet') return 'maps';
          if (pkg === 'lucide-react' || pkg === '@tabler/icons-react') return 'icons';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
