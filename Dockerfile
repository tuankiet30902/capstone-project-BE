# FROM node:lts-alpine
FROM node:10.15.0
ENV NODE_ENV=production
ENV HOST=0.0.0.0
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --unsafe-perm=true --allow-root --production --silent && mv node_modules ../
COPY . .

ENV NODE_ENV=${NODE_ENV}
ENV HOST=${HOST}

EXPOSE 3000
ENTRYPOINT [ "node", "server.js" ]
