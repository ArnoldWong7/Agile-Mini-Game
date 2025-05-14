# 1. 构建前端
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. 生产镜像
FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/build ./build
COPY server ./server
COPY src/template.json ./src/template.json
COPY public ./public
COPY server/index.js ./server/index.js
COPY postcss.config.mjs ./
COPY README.md ./

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server/index.js"] 