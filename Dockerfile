FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY client ./client
COPY server ./server
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    UPLOAD_DIR=/app/uploads
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/client/dist ./client/dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
VOLUME ["/app/uploads"]
EXPOSE 4000
CMD ["node", "server/src/server.js"]
