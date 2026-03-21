FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* tsconfig.base.json ./
COPY coprocessor/package.json ./coprocessor/

RUN npm ci

COPY coprocessor/src ./coprocessor/src

EXPOSE 4010

CMD ["npx", "tsx", "/app/coprocessor/src/index.ts"]
