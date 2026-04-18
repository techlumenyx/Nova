FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/chat/package.json ./services/chat/

RUN npm ci

COPY shared/src ./shared/src
COPY services/chat/src ./services/chat/src

RUN cd shared && npm run build
RUN cd services/chat && npm run build

EXPOSE 4004

CMD ["node", "/app/services/chat/dist/index.js"]
