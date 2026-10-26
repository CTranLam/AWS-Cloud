# Docker — Simple App

A Node.js Express app containerized with Docker.

## Install Docker

> Guide: https://docs.docker.com/desktop/

**macOS**
```sh
brew install --cask docker
```

**Linux (Ubuntu/Debian)**
```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # run docker without sudo (re-login required)
```

**Windows** — Download [Docker Desktop](https://www.docker.com/products/docker-desktop)

Verify installation:
```sh
docker --version
```

---

## Common Commands

### Build

```sh
# Build image with a tag
docker build -t simple-app .

# Build with a specific tag version
docker build -t simple-app:1.0.0 .

# Build multiple platform
docker buildx build --platform linux/amd64,linux/arm64 \
  -t your-username/simple-app:latest --push .

# Build multiple platform for docker hub
docker buildx build --platform linux/amd64,linux/arm64 \
  -t vietaws/demo:v1 --push .

```

### Images

```sh
# List all local images
docker images

# Remove an image
docker rmi simple-app
```

### Run

```sh
# Run container locally (detached, port mapped)
docker run -d -p 8081:8080 --name simple-app1 simple-app

# Run with environment variables
docker run -d -p 8082:8080 -e BACKGROUND_COLOR=green --name simple-app2 simple-app

# Run interactively (foreground)
docker run -it --rm -p 8083:8080 simple-app
```

App will be available at: http://localhost:8081

### Containers

```sh
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Stop a container
docker stop simple-app

# Remove a container
docker rm simple-app
```

### Exec

```sh
# Open a shell inside a running container
docker exec -it simple-app sh

# Run a one-off command
docker exec simple-app node --version
```

### Logs

```sh
# View container logs
docker logs simple-app

# Follow logs in real time
docker logs -f simple-app

# Show last 50 lines
docker logs --tail 50 simple-app
```
