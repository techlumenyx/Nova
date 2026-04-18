FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/commerce/package.json ./services/commerce/

RUN npm ci

COPY shared/src ./shared/src
COPY services/commerce/src ./services/commerce/src

RUN cd shared && npm run build
RUN cd services/commerce && npm run build

EXPOSE 4003

CMD ["node", "/app/services/commerce/dist/index.js"]
