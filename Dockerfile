FROM node:24-alpine3.22

#create app directory
WORKDIR /app

# install dependencies 
# A Wildcard to make sure that we will copy both package.json and package-lock.json
COPY package*.json /app/

RUN npm install

# Bundle app source
COPY . . 

USER node

EXPOSE 8080
CMD ["npm", "start"]