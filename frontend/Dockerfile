FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist

# Cloud Run sets PORT; default to 8080
ENV PORT=8080

CMD ["serve", "-s", "dist", "-l", "8080"]

