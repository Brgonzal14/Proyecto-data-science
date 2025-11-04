FROM node:20-alpine


WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production


COPY public ./public
COPY server.js ./


# carpeta/volumen de datos para SQLite
RUN mkdir -p data
VOLUME ["/app/data"]


ENV PORT=3000
EXPOSE 3000


CMD ["node","server.js"]