FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY services/profile/package.json ./services/profile/

RUN npm ci

COPY shared/src ./shared/src
COPY services/profile/src ./services/profile/src

RUN cd shared && npm run build
RUN cd services/profile && npm run build

EXPOSE 4002

CMD ["node", "/app/services/profile/dist/index.js"]
