FROM node:14-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

#RUN npm install -g @vue/cli@4.5.17

# RUN npm install
# If you are building your code for production
RUN npm ci --only=production
RUN npm run build:ui

# Bundle app source
COPY . .

EXPOSE 3010
CMD [ "npm", "start:server" ]