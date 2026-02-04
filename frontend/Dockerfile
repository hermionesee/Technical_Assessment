# specifies the base image that the build will extend
FROM node:18-alpine

# goes to app dir (cd terminal cmd)
WORKDIR /app

# copy package.json and package-lock.json
COPY package*.json ./

# install app dependencies
RUN npm install

# copy rest of app into container
COPY . .

# expose 3000 port
EXPOSE 3000

# run app
CMD ["npm", "start"]
