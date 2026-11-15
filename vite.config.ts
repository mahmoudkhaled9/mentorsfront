import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

const JSPDF_DEPS = /node_modules\/(html2canvas|canvg|core-js|dompurify|pako|fast-png|fflate|iobuffer|svg-pathdata|stackblur-canvas|rgbcolor|raf|performance-now|@babel\/runtime)\//;

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    // The API address is compiled into the bundle. Without VITE_API_BASE the app falls back to http://localhost:4001/api,
    // which only works on the developer's own machine: say so loudly instead of shipping a bundle that cannot log in.
    const api = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE ?? '';
    if (!api || /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(api)) {
      console.warn(`\n[mentors] This build calls a LOCAL API (${api || 'default http://localhost:4001/api'}). Fine for testing on this machine; for a real deployment set VITE_API_BASE=https://<your-api-domain>/api in .env.production.\n`);
    }
  }
  return {
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
            // Vite's dynamic-import helper is needed by the entry chunk. Left unassigned, Rollup put it inside the first
            // lazy chunk that used it (jsPDF's), so index.html preloaded the whole PDF library at startup.
            if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor';
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('recharts')) return 'charts';
            // Separate chunks: exporting a PDF (jsPDF) must not download the PDF reader (pdf.js) and vice versa.
            if (id.includes('pdfjs-dist')) return 'pdfjs';
            if (id.includes('jspdf')) return 'jspdf';
            // jsPDF's own dependencies (~1 MB before minification). The 'vendor' catch-all below would load them at
            // startup; left unassigned, Rollup keeps them with jsPDF (or in their own lazy chunks), i.e. on demand.
            if (JSPDF_DEPS.test(id)) return undefined;
            if (id.includes('xlsx')) return 'xlsx';
            if (id.includes('date-fns')) return 'date-fns';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          },
        },
      },
    },
  };
});
