FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=5173 AINA_INPUT_MODE=keyboard ASR_PROVIDER=disabled CHAT_PROVIDER=scripted TTS_PROVIDER=local
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public/audio ./public/audio
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/tools ./tools
COPY --from=build --chown=node:node /app/local-speech/build-freshness.js ./local-speech/build-freshness.js
COPY --from=build --chown=node:node /app/local-speech/startup-ui.js ./local-speech/startup-ui.js
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/package*.json ./
USER node
EXPOSE 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:5173/api/config').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "-e", "import('./server/local.js').then(({createLocalApp})=>createLocalApp().listen(5173,'0.0.0.0'))"]
