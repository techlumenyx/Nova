FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/commerce/package.json ./services/commerce/

RUN npm ci

COPY shared/src ./shared/src
COPY services/commerce/src ./services/commerce/src
COPY services/commerce/prisma ./services/commerce/prisma

WORKDIR /app/services/commerce

RUN npx prisma generate

EXPOSE 4003

CMD ["npx", "tsx", "/app/services/commerce/src/index.ts"]
