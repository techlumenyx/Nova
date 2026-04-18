FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/auth/package.json ./services/auth/

RUN npm ci

COPY shared/src ./shared/src
COPY services/auth/src ./services/auth/src

RUN cd shared && npm run build
RUN cd services/auth && npm run build

EXPOSE 4001

CMD ["node", "/app/services/auth/dist/index.js"]
