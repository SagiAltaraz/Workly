FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY samples ./samples
EXPOSE 4000
CMD ["npm", "start"]
