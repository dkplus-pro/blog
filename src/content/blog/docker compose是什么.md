---
title: 'Docker Compose 是什么？用 compose.yml 管理多容器应用'
date: 2026-07-04
tags: ['Docker', 'Docker Compose', 'compose.yml', '容器化', '部署']
description: '理解 Docker Compose 的作用，学习如何用 compose.yml 声明多个服务、网络和数据卷，简化多容器应用的启动与管理'
draft: false
---

## 使用 compose.yml 声明多个服务、网络和卷

当项目只有一个容器时，可以直接使用 `docker run` 启动。

但是一旦项目里有多个服务，比如：

```txt
Node API
MySQL
Redis
Nginx
```

继续手写 `docker run` 就会变得很麻烦。

例如你需要分别创建网络、创建 volume、启动 MySQL、启动 Redis、启动 Node，并且每个命令都要写一堆参数。

这时就可以使用 Docker Compose。

Docker Compose 的作用是：

```txt
用一个 compose.yml 文件声明多个容器怎么启动、怎么联网、怎么挂载数据卷。
```

也就是说，Compose 不是用来构建单个镜像的，它更像是一个“多容器应用启动说明书”。

## 一、compose.yml 是什么？

`compose.yml` 是 Docker Compose 的配置文件。

它可以描述：

```txt
有哪些服务 services
每个服务使用哪个镜像 image
哪个服务需要 build
哪些端口要暴露 ports
哪些环境变量 environment
哪些数据卷 volumes
哪些网络 networks
服务之间有什么依赖 depends_on
```

一个典型的 `compose.yml` 结构是：

```yaml
services:
  node-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: mysql
      REDIS_HOST: redis
    depends_on:
      - mysql
      - redis
    networks:
      - app-network

  mysql:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: 123456
      MYSQL_DATABASE: app
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - app-network

  redis:
    image: redis:7
    volumes:
      - redis-data:/data
    networks:
      - app-network

volumes:
  mysql-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

这个文件描述了三个服务：

```txt
node-api
mysql
redis
```

还声明了两个 named volume：

```txt
mysql-data
redis-data
```

以及一个自定义 bridge 网络：

```txt
app-network
```

## 二、用 services 声明多个服务

`services` 是 Compose 里最核心的部分。

每个 service 可以理解成一个容器配置。

例如：

```yaml
services:
  node-api:
    build: .
    ports:
      - "3000:3000"
```

这里声明了一个叫 `node-api` 的服务。

它的含义是：

```txt
用当前目录下的 Dockerfile 构建镜像
启动后把容器 3000 端口映射到宿主机 3000 端口
```

如果服务不需要自己构建镜像，而是直接用官方镜像，可以写：

```yaml
services:
  redis:
    image: redis:7
```

这表示直接使用 `redis:7` 镜像启动 Redis 服务。

## 三、用 volumes 声明 named volume

在 Compose 里，数据卷可以统一写在文件底部：

```yaml
volumes:
  mysql-data:
  redis-data:
```

然后在具体服务里挂载：

```yaml
services:
  mysql:
    image: mysql:8
    volumes:
      - mysql-data:/var/lib/mysql
```

这表示：

```txt
把 Docker 管理的 mysql-data 卷
挂载到 MySQL 容器里的 /var/lib/mysql 目录
```

MySQL 的数据会写入 `mysql-data`，而不是只写在容器可写层里。

这样即使 MySQL 容器被删除，只要 volume 还在，数据就还在。

Redis 也类似：

```yaml
services:
  redis:
    image: redis:7
    volumes:
      - redis-data:/data
```

这里的 `redis-data` 会保存 Redis 的持久化数据。

## 四、用 networks 声明自定义 bridge 网络

在 Compose 里可以这样声明网络：

```yaml
networks:
  app-network:
    driver: bridge
```

然后让多个服务加入这个网络：

```yaml
services:
  node-api:
    networks:
      - app-network

  mysql:
    networks:
      - app-network

  redis:
    networks:
      - app-network
```

这样 `node-api`、`mysql`、`redis` 就处在同一个 Docker 网络里。

它们之间可以通过服务名互相访问。

## 五、理解服务名就是默认 DNS 名称

在 Docker Compose 中，服务名默认就是容器之间互相访问的 DNS 名称。

例如有这个服务：

```yaml
services:
  mysql:
    image: mysql:8
```

那么在同一个 Compose 网络里，其他服务可以直接访问：

```txt
mysql:3306
```

有这个服务：

```yaml
services:
  redis:
    image: redis:7
```

其他服务可以直接访问：

```txt
redis:6379
```

所以 Node 服务的环境变量可以写成：

```yaml
services:
  node-api:
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      REDIS_HOST: redis
      REDIS_PORT: 6379
```

这里的 `mysql` 和 `redis` 不是公网域名，也不是宿主机地址，而是 Compose 网络里的服务名。

也就是说：

```txt
node-api 容器访问 mysql
Docker Compose 自动把 mysql 解析到 MySQL 容器的内网 IP

node-api 容器访问 redis
Docker Compose 自动把 redis 解析到 Redis 容器的内网 IP
```

这也是为什么容器之间不要写 `localhost`。

在 `node-api` 容器里，`localhost` 指的是 `node-api` 容器自己，不是 MySQL，也不是 Redis。

正确写法是：

```env
DB_HOST=mysql
REDIS_HOST=redis
```

而不是：

```env
DB_HOST=localhost
REDIS_HOST=localhost
```

## 六、ports 只用于暴露给宿主机或公网

很多人会误以为容器之间通信必须写 `ports`。

其实不是。

例如 MySQL 服务：

```yaml
services:
  mysql:
    image: mysql:8
    ports:
      - "3306:3306"
```

这表示把 MySQL 暴露到宿主机的 3306 端口。

如果只是 Node 容器访问 MySQL，那么不需要暴露 `3306` 到宿主机。

可以写成：

```yaml
services:
  mysql:
    image: mysql:8
    networks:
      - app-network
```

只要 Node 和 MySQL 在同一个网络里，Node 仍然可以通过：

```txt
mysql:3306
```

访问 MySQL。

所以正式环境里，通常只暴露真正需要被外部访问的服务。

例如：

```yaml
services:
  node-api:
    ports:
      - "3000:3000"

  mysql:
    image: mysql:8

  redis:
    image: redis:7
```

这表示：

```txt
node-api 对外开放 3000
mysql 不对外开放，只给内部容器访问
redis 不对外开放，只给内部容器访问
```

这样更安全。

## 七、depends_on 只是控制启动顺序

在 Compose 里可以写：

```yaml
services:
  node-api:
    depends_on:
      - mysql
      - redis
```

这表示启动 `node-api` 前，先启动 `mysql` 和 `redis`。

但是要注意：

```txt
depends_on 只能保证容器启动顺序，
不能保证 MySQL 已经完全初始化完成。
```

也就是说，MySQL 容器启动了，不代表数据库已经可以立刻连接。

所以实际项目中，Node 服务最好自己具备重试连接能力。

例如：

```txt
连接 MySQL 失败
等待 2 秒
重试连接
超过最大次数再退出
```

不要完全依赖 `depends_on` 解决服务就绪问题。

## 八、docker compose up：启动服务

写好 `compose.yml` 后，在文件所在目录执行：

```bash
docker compose up
```

这会以前台方式启动服务，日志会直接输出在当前终端。

更常用的是后台启动：

```bash
docker compose up -d
```

其中 `-d` 表示 detached mode，也就是后台运行。

如果镜像不存在，Compose 会自动拉取镜像。

如果某个服务配置了：

```yaml
build: .
```

Compose 会根据当前目录的 Dockerfile 构建镜像。

如果你想强制重新构建，可以执行：

```bash
docker compose up -d --build
```

常用命令：

```bash
docker compose up -d
docker compose up -d --build
```

## 九、docker compose logs：查看日志

查看所有服务日志：

```bash
docker compose logs
```

持续跟踪日志：

```bash
docker compose logs -f
```

只看某一个服务的日志：

```bash
docker compose logs -f node-api
```

例如 Node 服务启动失败，可以先看：

```bash
docker compose logs -f node-api
```

MySQL 初始化失败，可以看：

```bash
docker compose logs -f mysql
```

这个命令是排查问题最常用的命令之一。

## 十、docker compose exec：进入容器执行命令

如果服务已经启动，可以用 `exec` 进入某个容器。

进入 Node 容器：

```bash
docker compose exec node-api sh
```

如果容器里有 bash，也可以：

```bash
docker compose exec node-api bash
```

进入 MySQL 容器：

```bash
docker compose exec mysql bash
```

或者直接进入 MySQL 命令行：

```bash
docker compose exec mysql mysql -uroot -p
```

进入 Redis 命令行：

```bash
docker compose exec redis redis-cli
```

`exec` 的特点是：

```txt
在已经运行的容器里执行命令。
```

如果容器没启动，`exec` 就不能用。

## 十一、docker compose down：停止并删除容器

停止服务可以执行：

```bash
docker compose down
```

它会：

```txt
停止容器
删除容器
删除 Compose 创建的默认网络
```

但是默认不会删除 named volume。

也就是说，如果你执行：

```bash
docker compose down
```

然后再执行：

```bash
docker compose up -d
```

MySQL 的数据还在，因为 `mysql-data` 这个 volume 没有被删除。

## 十二、docker compose down -v：连卷一起删除

如果执行：

```bash
docker compose down -v
```

就会在停止和删除容器的同时，把 Compose 管理的 volume 也删除。

这意味着：

```txt
MySQL 数据会被删
Redis 持久化数据会被删
上传文件如果存在 volume 里，也会被删
```

所以这条命令要非常谨慎。

在开发环境中，如果你想清空数据库重新来，可以用：

```bash
docker compose down -v
docker compose up -d
```

但在生产环境，不要随便执行：

```bash
docker compose down -v
```

因为它可能直接删除持久化数据。

## 十三、一个完整的 compose.yml 示例

下面是一个 Node + MySQL + Redis 的完整示例：

```yaml
services:
  node-api:
    build: .
    container_name: node-api
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: root
      DB_PASSWORD: 123456
      DB_NAME: app
      REDIS_HOST: redis
      REDIS_PORT: 6379
    depends_on:
      - mysql
      - redis
    networks:
      - app-network

  mysql:
    image: mysql:8
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: 123456
      MYSQL_DATABASE: app
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - app-network

  redis:
    image: redis:7
    container_name: redis
    volumes:
      - redis-data:/data
    networks:
      - app-network

volumes:
  mysql-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

启动：

```bash
docker compose up -d --build
```

查看服务状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f node-api
```

进入 Node 容器：

```bash
docker compose exec node-api sh
```

停止并删除容器：

```bash
docker compose down
```

清空容器和 volume：

```bash
docker compose down -v
```

## 十四、总结

Docker Compose 主要解决的是多容器应用的启动和管理问题。

可以记住这几句话：

```txt
Dockerfile 负责描述如何构建一个镜像。
compose.yml 负责描述多个服务如何一起运行。
services 用来声明服务。
volumes 用来声明 named volume。
networks 用来声明自定义网络。
服务名就是默认 DNS 名称。
容器之间用服务名访问，不用 localhost。
```

常用命令也可以这样记：

```txt
docker compose up -d：后台启动服务
docker compose up -d --build：重新构建并启动
docker compose logs -f：查看实时日志
docker compose logs -f 服务名：查看某个服务日志
docker compose exec 服务名 sh：进入运行中的容器
docker compose down：停止并删除容器，但保留 volume
docker compose down -v：停止并删除容器，同时删除 volume
```

最重要的一点是：

```txt
down -v 会删除持久化数据，生产环境不要随便执行。
```
