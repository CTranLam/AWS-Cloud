# FROM node:24-alpine3.22
FROM public.ecr.aws/docker/library/node:24.16-alpine3.23

#create app directory
WORKDIR /app

# install dependencies 
# A Wildcard to make sure that we will copy both package.json and package-lock.json
COPY package*.json .

RUN npm install

# Bundle app source
COPY . . 

EXPOSE 3001
CMD ["npm", "start"]