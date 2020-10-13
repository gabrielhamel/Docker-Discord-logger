FROM debian

# Install curl
RUN apt-get update -y && apt-get upgrade -y && apt-get install -y curl docker.io

# Docker
RUN usermod -g docker root

# Install Nodejs
RUN curl -sL https://deb.nodesource.com/setup_current.x | bash -
RUN apt-get install -y nodejs

# Copy and configure application
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

CMD [ "npm", "start" ]
