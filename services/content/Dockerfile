FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/content/package.json ./services/content/

RUN npm ci

COPY shared/src ./shared/src
COPY services/content/src ./services/content/src

RUN cd shared && npm run build
RUN cd services/content && npm run build

EXPOSE 4005

CMD ["node", "/app/services/content/dist/index.js"]
