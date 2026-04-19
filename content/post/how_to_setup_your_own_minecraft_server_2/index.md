---
title: How to setup your own minecraft server Part 2
description: Me and my friend wanted to play Minecraft together. This is how we made a server.
slug: how_to_make_a_minecraft_server_2
date: 2026-04-19
image: images/img3.png
coverHeight: l3
categories:
    - Games
    - English
tags:
    - Guide
    - Games
    - Minecraft
    - English
---

# How to setup your own minecraft server

Java, latest version, your Linux hardware (over network), free, official/hacked, online, ~20 players, safe

>*Disclaimer*\
\
Just like [part 1](https://ananasikdev.github.io/blog/p/how_to_make_a_minecraft_server/), this is just a reminder I am writing for myself to not forget what I have done.\
\
My setup is as following: my server runs on Raspberry Pi in my local network, I (usually) also connect from the same network, and my friend connects from over the internet. We stared on the latest version of Minercaft 26.1.2. My Raspberry has Raspberry Pi OS installed, which is a Debian-based Linux distro.\
\
I am not verse in Linux, and it was my first experience with networking, servers and web security. Please always remain cautious and double check important aspects, especially when it comes to networking. Most of the steps I describe were suggested to me by an LLM, and I combined and filtered them according to what worked out, in what order, etc.

## Setup your Linux machine and establish connection

As I said I am using a Raspberry, so all I had to do is to power it up and ssh into it, using my login and password. If you are doing it for the first time, search up how to do it. It also has to be connected to your network, e.g. via WiFi.

```sh
ssh <user>@<host>
```

or

```sh   
ssh <user>@<IP address>
```

## Install Java

I am working in a Debian-based system, so most downloads will be done with `sudo apt install`. Remember to `sudo apt update` beforehand.

```sh
sudo apt install -y openjdk-25-jdk
```
(`-y` means "assume yes" see [apt source code](https://github.com/Debian/apt/blob/a79b29f32141b17cf8f923e1f2bc377749c555d8/completions/bash/apt))

You have to have Java of the version corresponding to your desired minecraft version

--------
| Minecraft | Java |
| :--: | :--: |
| 1.6.1 - 1.11.2 | Java 6 |
| 1.12 - 1.16.5 | Java 8 |
| 1.17 - 1.17.1 | Java 16 |
| 1.18 - 1.20.4 | Java 17 |
| 1.20.5 - 1.21.11 | Java 21 |
| 26.1+ | Java 25 |

You can check which version you need to have [here](https://minecraft.wiki/w/Tutorial:Update_Java).

Check if it was installed correctly:

```sh
java -version
```

---

## Official minecraft server software

Install minecraft official server setup software. It should be a file named `server.jar` downloaded from [official minecraft page](https://www.minecraft.net/en-us/download/server). AFAIK only the latest MC release is available here. For a simple setup you won't need console and running commands as opposed to what's said on that page.

Alternatively, you may download it from other websites like [mcversions](https://mcversions.net/download/1.21.1) where you can choose a specific version.

---

## Dedicate a folder to the server files

You will need a folder somewhere on your server machine where your server will live.

I am unaware of a method to download it using `apt` in Debian, so I simply downloaded it on my Windows machine and copied the files over to the Raspberry using `scp FROM TO` Command Prompt line in Windows. `scp` stands for "**s**ecure **c**o**p**y".

Anyhow, you need to put that `server.jar` file to the server root directory.

---

## Generate server files

Run `server.jar`. In a few seconds it should generate a bunch of files around it (along with `server.properties` and `eula.txt`).

---

## Tweak server settings

### EULA

First and foremost, you must open ```eula.txt``` and set ```eula``` to ```true```, so that the whole file looks like this (with your date and time, of course):

```
#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#Mon Mar 11 13:11:52 CET 2024
eula=true
```

Do not forget to save the file!

### Security

#### Online mode

Then, if you or your friends who you are planning to play with are using cracked minecraft, you also need to go to `server.properties` and change `online-mode` to `false`. I strongly recommend leave `online-mode` set to `true`.

#### White list

Furthermore, I advise to setup a whitelist. You will not be able to fill it in manually, but once the server is running at any point, you type in the command line `whitelist add <nickname>`

Read more about whitelist: https://minecraft.fandom.com/wiki/Commands/whitelist

Plus, in `server.properties` consider setting the max number of players to the expected value.

### Gameplay

In the same `server.properties` you are also able to set difficulty, gamemode (including hardcore), max number of players, pvp, whitelist, generate structures and view distance along with other settings. I recommend leaving the gameplay-related ones default and tweak them after succeeding in setting up the server to work correctly.

---

## Wire Guard

Wire Guard is a VPN (private tunnel) that will connect other users with your server. We will later expose a port in our router to forward an incoming UDP request to that one port (51820) to the Wire Guard, which will process that request if and only if the encryption keys match, giving no random access into your network.

### Server side

```sh
sudo apt update
sudo apt install wireguard
```

Generate server-side keys:

```sh
wg genkey | tee server_private.key | wg pubkey > server_public.key
```
(store them somewhere separately)

Open config:

```sh
sudo vim /etc/wireguard/wg0.conf
```

Paste this and change the <server_private_key> and <client_public_key> to ones generated

```ini
[Interface]
PrivateKey = <server_private_key>
Address = 10.0.0.1/24
ListenPort = 51820 # default WireGuard port

# Client
[Peer]
PublicKey = <client_public_key>
AllowedIPs = 10.0.0.2/32
```

Enable the Wire Guard (on the server):

```sh
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0
```

### Client side

Then back to the client. They will need to install Wire Guard application on their machine, available for pretty much every OS: https://www.wireguard.com/install/

On the server, generate the client-side keys:

```sh
wg genkey | tee client_private.key | wg pubkey > client_public.key
```

(store them somewhere separately)

```ini
[Interface]
PrivateKey = <client_private_key>
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <server_public_key>
Endpoint = <your_public_ip>:51820
AllowedIPs = 10.0.0.0/24
PersistentKeepalive = 25
```

## Port forward WireGuard

Go to your router web interface, find forward port setting.

Port forward only 51820/UDP -> <Pi local IP> (check it by writing `hostname -I`)

Don't forward any other ports, like 25565 (Minecraft default port), because we are handling it manually and securely.

While you are in the router settings, make your server IP static. How to do it depends on your router of course, e.g. in (Advanced) -> Network -> Address Reservation -> add.

## Setup a firewall

**Please be very careful with the firewall. If you lock yourself out, you will have to connect to it using a keyboard and a mouse OR reset it entirely.**

I use ufw. Consider researching it yourself. [Tutorial](https://linuxize.com/post/ufw-command-in-linux/). Keep in mind I am doing it for my first time.

I setup ufw in such a way that the only connection from anywhere (all of internet) that is accepts is to Wire Guard. Since it is greatly secured with encryption, and this port is the only one open on my router, it should be good.

It also accepts a few connections from my local network: SSH and Minecraft (25565).

And through the Wire Guard tunnel (from the client's IP, local to the tunnel network), it also accepts the only other client's IP.

So overall it should be setup like this:
------
| to | from | protocol |
| :-: | :-: | :-: |
| Wire Guard (51820) | Anywhere | UDP |
| Minecraft (25565) | Local network (192.168.0.0/16) | TCP |
| Minecraft (25565) | Tunnel network (10.0.0.0/24) | TCP |
| SSH (22) | Local network (192.168.0.0/16) | TCP |

```sh
sudo ufw status numbered
sudo vim /etc/default/ufw
```

to delete a rule:

```sh
sudo ufw delete 4 # whatever number of the rule you want to remove
```

to add a rule:

```sh
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp
```

This will allow access to the 22 (SSH) port using TCP protocol (doesn't work with UDP) from the specified IP range (/16 declares a range from `192.168.0.1` to `192.168.255.254`)

Only run this command once you are sure of your changes. If you block your SSH connection and reload ufw, you will no longer have access to it.
```sh
sudo ufw reload
```

---

## Try it!

### Launch
```sh
java -Xms1G -Xmx2G -jar server.jar nogui
```
-Xms specifies the initial memory allocation pool (1 GB)\
-Xmx specifies the maximum memory allocation pool (2 GB)\
See [Stackoverflow](https://stackoverflow.com/questions/14763079/what-are-the-xms-and-xmx-parameters-when-starting-jvm)

### Connect

Open Minecraft -> Multiplayer -> Direct connection

From local network:

```
<your_linux_server_local_ip>:25565
```

From elsewhere, aka your friend:

```
10.0.0.1
```

If anything doesn't work, proceed to troubleshooting. Could be something small!

---

## Setup PaperMC

Once everything works, you realize that a Raspberry Pi is slow and weak. So let's setup PaperMC, which optimizes it a fair bit.

### Download

First, download the .jar file of the papermc. Either by downloading it manually from [papermc.io](https://papermc.io/downloads/paper) and `scp`-ing from your machine to the server, or get it on the Linux directly using `wget` for example.

### Make a bootup script

Note, that this script will be redundant if you decide to do Step 13.

Make a bash script `start.sh` in your server directory:

```sh
#!/bin/bash
java -Xms1500M -Xmx1500M \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:G1HeapRegionSize=32M \
  -jar paper-26.1.2-7.jar --nogui
```

Make a simple Windows Power Shell script `server.ps1` to run the server in one click:
```ps
& Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh <user>@<host> "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
& ssh <user>@<host> "cd <server_directory> && bash start.sh"
```

You can then create a shortcut in Windows so you can just right click it and choose "Run in Power Shell". Done!

---

## Make a Linux service (recommended)

Right now the Minecraft server runs as a normal background process and is hard to control.

```sh
sudo vim /etc/systemd/system/minecraft.service
```

Paste this:

```sh
[Unit]
Description=PaperMC Server
After=network.target

[Service]
User=minecraft
Group=minecraft
WorkingDirectory=/opt/minecraft/server

ExecStart= java -Xms1500M -Xmx1500M \
  -XX:+UseG1GC \
  -XX:+ParallelRefProcEnabled \
  -XX:MaxGCPauseMillis=200 \
  -XX:+UnlockExperimentalVMOptions \
  -XX:+DisableExplicitGC \
  -XX:G1HeapRegionSize=32M \
  -jar /opt/minecraft/server/paper-26.1.2-7.jar --nogui

Restart=always
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal

# Safety hardening (good practice)
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Change `/opt/minecraft/server` to your actual server directory though.

Create a Linux user called `minecraft`:
```sh
sudo adduser --system --home /opt/minecraft minecraft
```

You will have to grant permission to the (Linux) user `minecraft` to write to the server files:
```sh
sudo chown -R minecraft:minecraft /opt/minecraft/server
sudo chmod -R 750 /opt/minecraft/server
```

## How to

### If you setup a Linux service

#### Start

Make sure the Linux server (Raspberry Pi) is functional, powered and running. It also has to be connected to your network.

#### Stop

```sh
sudo systemctl stop minecraft
```

#### Restart

```sh
sudo systemctl restart minecraft
```

#### Status

```sh
sudo systemctl status minecraft
```

To display logs (to see how the server is launching e.g.)
```sh
journalctl -u minecraft -f
```

### If you didn't

#### Start

Run the `start.sh` bash script on your server OR the `server.ps1` Power Shell script on your Windows machine.

Otherwise you can just launch the `server.jar` file directly:
```sh
java -Xms1G -Xmx2G -jar server.jar nogui
```

#### Stop

```sh
ps aux | grep java
kill <minecraft_java_pid>
```

#### Restart

Do Stop, then Start

## Troubleshoot

If getting errors, check following:

1. **Internet** connection is stable
2. **Java** version is correct
3. **Minecraft** is of correct version (same as server)
4. **Server** is running
5. Linux **`minecraft` service** is enabled and granted permissions to the server directory
6. Linux **`minecraft` user** is created and granted permissions to the server directory
7. **EULA** is accepted
8. Minecraft **whitelist** is either disabled or is correctly filled in
9. **Paths** are all correct (in commands, scripts and configs)

For non-local-network connections:
1. **Wireguard port** is forwarded by the router
2. **Router** is allowing the port
3. **ufw** is either disabled or is allowing the port
4. **Wireguard** is enabled for BOTH Raspberry AND user