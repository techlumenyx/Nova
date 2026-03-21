FROM node:22-alpine

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/auth/package.json ./services/auth/

RUN npm ci

# Copy source
COPY shared/src ./shared/src
COPY services/auth/src ./services/auth/src
COPY services/auth/prisma ./services/auth/prisma

WORKDIR /app/services/auth

RUN npx prisma generate

EXPOSE 4001

CMD ["npx", "tsx", "/app/services/auth/src/index.ts"]
