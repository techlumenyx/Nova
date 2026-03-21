FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/chat/package.json ./services/chat/

RUN npm ci

COPY shared/src ./shared/src
COPY services/chat/src ./services/chat/src
COPY services/chat/prisma ./services/chat/prisma

WORKDIR /app/services/chat

RUN npx prisma generate

EXPOSE 4004

CMD ["npx", "tsx", "/app/services/chat/src/index.ts"]
