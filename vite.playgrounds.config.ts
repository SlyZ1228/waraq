import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins:[react()], base:'./', publicDir:false,
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  resolve:{alias:{'virtual:pwa-register/react':fileURLToPath(new URL('./src/standalone.ts',import.meta.url))}},
  build:{outDir:'.data/playgrounds-web',emptyOutDir:true,
    lib:{entry:'src/main.tsx',name:'Waraq',formats:['iife'],fileName:()=> 'app.js',cssFileName:'app'},
  },
});
