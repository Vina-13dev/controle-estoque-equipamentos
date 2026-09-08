import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Troque 'estoque-equipamentos' pelo nome exato do seu repositório no GitHub
// se for publicar em https://SEU_USUARIO.github.io/NOME_DO_REPO/
export default defineConfig({
  plugins: [react()],
  base: '/estoque-equipamentos/',
})
