FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/content/package.json ./services/content/

RUN npm ci

COPY shared/src ./shared/src
COPY services/content/src ./services/content/src
COPY services/content/prisma ./services/content/prisma

WORKDIR /app/services/content

RUN npx prisma generate

EXPOSE 4005

CMD ["npx", "tsx", "/app/services/content/src/index.ts"]
