FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/profile/package.json ./services/profile/

RUN npm ci

COPY shared/src ./shared/src
COPY services/profile/src ./services/profile/src
COPY services/profile/prisma ./services/profile/prisma

WORKDIR /app/services/profile

RUN npx prisma generate

EXPOSE 4002

CMD ["npx", "tsx", "/app/services/profile/src/index.ts"]
