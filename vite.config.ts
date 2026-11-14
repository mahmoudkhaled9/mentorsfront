import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Absolute base: the app uses BrowserRouter at the domain root (public/.htaccess has RewriteBase /), so a relative
  // './' base made nested URLs such as /leads/1 or /admin/users load ./assets/... from /leads/assets/... on refresh
  // and render a white page. Deploying under a sub-folder would need this and the router's basename changed together.
  base: '/',
  plugins: [command === 'serve' ? inspectAttr() : null, react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('pdfjs-dist') || id.includes('jspdf')) return 'pdf';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
}));
