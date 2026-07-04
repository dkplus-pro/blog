---
title: 'Docker 的数据卷与网络：理解容器可写层、Volume 和 Bridge 网络'
date: 2026-07-04
tags: ['Docker', 'Volume', '网络', 'Bridge', '容器化']
description: '理解 Docker 容器可写层、named volume 和自定义 bridge 网络，说明容器数据持久化和多容器通信的基本原理'
draft: false
---

## 理解容器可写层、named volume 和自定义 bridge 网络

掌握 Dockerfile 之后，还需要理解 Docker 运行容器时的几个核心概念：容器可写层、数据卷 volume、自定义 bridge 网络。

这几个概念决定了容器里的数据会不会丢、多个容器之间怎么通信，以及为什么正式环境不能把重要数据直接放在容器内部。

## 一、容器删除后，容器可写层会消失

Docker 镜像本身是只读的。

当我们通过镜像启动一个容器时，Docker 会在镜像上方加一层“可写层”。

可以理解为：

```txt
镜像层：只读，不变
容器可写层：运行时产生的数据，容器独有
```

比如我们执行：

```bash
docker run -it ubuntu bash
```

进入容器后创建一个文件：

```bash
echo "hello docker" > /tmp/demo.txt
```

这个文件并不是写进镜像里的，而是写进当前容器的可写层。

如果退出容器，但容器没有删除，这个文件还在。

但是如果执行：

```bash
docker rm 容器ID
```

这个容器被删除后，它的可写层也会一起消失。

这意味着：

```txt
写在容器内部的数据，不适合作为长期数据保存。
```

例如下面这些数据，不能只放在容器可写层里：

```txt
MySQL 数据文件
Redis 持久化文件
用户上传文件
日志文件
业务生成的附件
```

否则容器一删除，数据就没了。

这也是 Docker 里一个很重要的原则：

```txt
容器应该是可以随时删除、随时重建的。
重要数据必须放到容器外部。
```

## 二、使用 named volume 持久化数据

如果我们希望容器删除后数据还在，就应该使用 Docker volume。

Docker volume 是 Docker 管理的一块持久化存储区域。

其中最常用的是 named volume，也就是有名字的数据卷。

例如创建一个 named volume：

```bash
docker volume create mysql-data
```

查看 volume：

```bash
docker volume ls
```

然后启动 MySQL 容器时，把这个 volume 挂载到 MySQL 的数据目录：

```bash
docker run -d \
  --name mysql \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

这里的关键是：

```txt
mysql-data:/var/lib/mysql
```

含义是：

```txt
把 Docker 管理的 mysql-data 数据卷
挂载到容器内部的 /var/lib/mysql 目录
```

MySQL 真正的数据会写到 `mysql-data` 这个 volume 里，而不是只写在容器可写层。

这样即使删除容器：

```bash
docker rm -f mysql
```

只要没有删除 volume，数据还在。

重新启动一个新 MySQL 容器并挂载同一个 volume：

```bash
docker run -d \
  --name mysql-new \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

之前的数据仍然可以继续使用。

## 三、named volume 和 bind mount 的区别

Docker 常见的数据挂载方式有两种：

```txt
named volume
bind mount
```

named volume 是 Docker 管理的卷：

```bash
-v mysql-data:/var/lib/mysql
```

bind mount 是把宿主机的某个目录挂载进容器：

```bash
-v /home/app/uploads:/app/uploads
```

区别大概是：

| 类型           | 示例                          | 适合场景                   |
| ------------ | --------------------------- | ---------------------- |
| named volume | `mysql-data:/var/lib/mysql` | 数据库、Redis、Docker 管理的数据 |
| bind mount   | `/home/app:/app`            | 本地开发、挂载代码、明确管理宿主机目录    |

对于数据库这类服务，推荐优先用 named volume。

原因是：

```txt
Docker 统一管理
不容易因为宿主机目录权限导致问题
迁移和备份更清晰
适合长期保存容器数据
```

但是对于开发环境，比如本地改 Node 代码，想让容器实时读取代码，可以用 bind mount：

```bash
docker run -d \
  --name node-dev \
  -v $(pwd):/app \
  -p 3000:3000 \
  node:20
```

## 四、容器之间不要靠 localhost 通信

很多初学者会遇到一个问题：

Node 容器里连接 MySQL，写成：

```txt
localhost:3306
```

结果连接失败。

原因是：

```txt
容器里的 localhost 指的是容器自己，不是宿主机，也不是其他容器。
```

如果 Node 和 MySQL 是两个容器：

```txt
node 容器
mysql 容器
```

在 Node 容器里访问 `localhost`，访问的是 Node 容器自己，而不是 MySQL 容器。

所以容器之间通信，应该使用 Docker 网络。

## 五、使用自定义 bridge 网络，让容器用服务名互相访问

Docker 默认有一个 bridge 网络，但正式使用时更推荐创建自己的自定义 bridge 网络。

创建网络：

```bash
docker network create app-network
```

启动 MySQL 容器，并加入这个网络：

```bash
docker run -d \
  --name mysql \
  --network app-network \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

启动 Node 容器，也加入同一个网络：

```bash
docker run -d \
  --name node-api \
  --network app-network \
  -p 3000:3000 \
  node-api:1.0.0
```

这样 Node 容器访问 MySQL 时，就可以直接使用容器名：

```txt
mysql:3306
```

例如数据库连接配置可以写成：

```env
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=123456
DB_NAME=app
```

这里的 `mysql` 不是域名，也不是服务器 IP，而是容器名。

在同一个自定义 bridge 网络中，Docker 会自动提供 DNS 解析，让容器可以通过名称互相访问。

也就是说：

```txt
node-api 容器访问 mysql
Docker 自动解析到 mysql 容器的内网 IP
```

## 六、为什么要用自定义 bridge 网络？

使用自定义 bridge 网络有几个好处。

第一，容器可以通过名称互相访问：

```txt
node-api → mysql
node-api → redis
nginx → node-api
```

不用写固定 IP。

第二，容器之间通信更清晰。

比如：

```txt
app-network
  ├── nginx
  ├── node-api
  ├── mysql
  └── redis
```

这些容器在同一个业务网络里。

第三，可以避免把所有服务都暴露到宿主机端口。

例如 MySQL 不一定要写：

```bash
-p 3306:3306
```

如果只有 Node 容器需要访问 MySQL，那么 MySQL 可以只在 Docker 内部网络里被访问，不对外暴露端口。

更安全的方式是：

```bash
docker run -d \
  --name mysql \
  --network app-network \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

没有 `-p 3306:3306`，外部不能直接访问 MySQL，但同网络内的 Node 容器可以通过 `mysql:3306` 访问。

## 七、一个完整示例：Node + MySQL + Redis

先创建网络和 volume：

```bash
docker network create app-network
docker volume create mysql-data
docker volume create redis-data
```

启动 MySQL：

```bash
docker run -d \
  --name mysql \
  --network app-network \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=app \
  -v mysql-data:/var/lib/mysql \
  mysql:8
```

启动 Redis：

```bash
docker run -d \
  --name redis \
  --network app-network \
  -v redis-data:/data \
  redis:7
```

启动 Node 服务：

```bash
docker run -d \
  --name node-api \
  --network app-network \
  -p 3000:3000 \
  -e DB_HOST=mysql \
  -e DB_PORT=3306 \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  node-api:1.0.0
```

这时访问关系是：

```txt
宿主机 / 外部用户
  ↓
localhost:3000 或 服务器IP:3000
  ↓
node-api 容器
  ↓
mysql:3306
redis:6379
```

其中：

```txt
node-api 对外暴露 3000
mysql 和 redis 不对外暴露，只在 Docker 网络内部使用
```

## 八、使用 docker-compose 简化管理

如果容器变多，用 `docker run` 会比较麻烦。

可以用 `docker-compose.yml` 统一管理。

例如：

```yaml
services:
  node-api:
    build: .
    container_name: node-api
    ports:
      - "3000:3000"
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
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
docker compose up -d
```

停止：

```bash
docker compose down
```

注意：

```bash
docker compose down
```

默认会删除容器和网络，但不会删除 named volume。

如果执行：

```bash
docker compose down -v
```

才会连 volume 一起删除。

这条命令要谨慎，因为它会删除持久化数据。

## 九、总结

Docker 容器运行时有一个可写层，容器内部新增或修改的文件，默认都会写在这个可写层里。

但是：

```txt
容器删除后，容器可写层也会消失。
```

所以重要数据不能只放在容器内部，而应该使用 named volume 持久化。

```txt
named volume：用于保存数据库、Redis、上传文件等长期数据。
```

多个容器之间通信时，不应该依赖 `localhost`，而应该使用自定义 bridge 网络。

```txt
自定义 bridge 网络：让容器可以通过服务名互相访问。
```

最终可以记住三句话：

```txt
容器可写层是临时的，容器删了就没了。
重要数据放 volume，容器重建数据还在。
容器互相访问走自定义 bridge 网络，用服务名，不用 localhost。
```
