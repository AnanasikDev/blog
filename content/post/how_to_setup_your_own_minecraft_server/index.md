---
title: How to setup your own minecraft server Part 1
description: Me and my friend wanted to play Minecraft together. This is how we made a server.
slug: how_to_make_a_minecraft_server
date: 2024-11-27
image: images/img2.png
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

Java, latest version, your hardware, free, official/hacked, online, ~20 players, safe

## Disclaimer

This is not an article but rather an instruction I made for myself to not forget how to setup a server. I was using Windows and doing that for cracked vanilla minecraft 1.21.3 so I can't say if it's working correctly in different conditions. It should generally be a universal approach as Java, Minecraft client and server, and Playit.gg have official ports to Linux and Mac (AFAIK).

This approach requires no use of console, no investments, you will have full control over your server. I listed pros and cons of it later in this note.

Some of the tutorials/resources that I used:
- [Host a Minecraft Server Without Port Forwarding Using Playit.gg -- video by KasaiSora](https://www.youtube.com/watch?v=itVVhcid2_Q&ab_channel=KasaiSora)
- [Making your minecraft server public in 48 seconds without port forwarding
 -- video by playit](https://www.youtube.com/watch?v=NK5lsDXIFnM&ab_channel=playit)
- [How To Make A Cracked Minecraft Server (Any Version)
 -- video by KasaiSora](https://www.youtube.com/watch?v=iJiTsM2MT3c&ab_channel=KasaiSora)
- [How to Setup a Minecraft: Java Edition Server -- help.minecraft.nent](https://help.minecraft.net/hc/en-us/articles/360058525452-How-to-Setup-a-Minecraft-Java-Edition-Server)
- [How to create a Minecraft server for free!
 -- cyberxgaming.com](https://cyberxgaming.com/how-to-create-a-minecraft-server-for-free/)

## Steps:

1. Install Java

You have to have Java of the version corresponding to your desired minecraft version (for 1.18+ it is Java 17, for 1.21+ it is Java 21 etc). You can check which version you need to have [here](https://docs.mcserversoft.com/advanced/java-version).

choose and download your version on [oracle website](https://www.oracle.com/java/technologies/downloads/archive/)

simply download it, run installer, nothing more to do here

---

2. Official minecraft server software

Install minecraft official server setup software. It should be a file named ```server.jar``` downloaded from [official minecraft page](https://www.minecraft.net/en-us/download/server). AFAIK only the latest MC release is available here. For a simple setup you won't need console and running commands as opposed to what's said on that page.

Alternatively, you may download it from other websites like [mcversions](https://mcversions.net/download/1.21.1) where you can choose a specific version.

---

3. Dedicate a folder to the server files

Put that ```server.jar``` file where you want to keep your server data. At this stage you should have a folder somewhere on your device where there is only that file.

---

4. Generate server files

Run ```server.jar``` file by double clicking it, it's java executable. In a few seconds it should generate a bunch of files around it (along with ```server.properties``` and ```eula.txt```). If so, move straight to step 5. It might take around 10 seconds, but If you waited and nothing happened, you need to install ```jarfix``` (program to fix 'java archive' execution issue on Windows) from [here](https://johann.loefflmann.net/en/software/jarfix/index.html) or [here](https://jarfix.en.softonic.com/). 

---

5. Tweak server settings

First and foremost, you must open ```eula.txt``` and set ```eula``` to ```true```, so that the whole file looks like this (with your date and time, of course):

```
#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#Mon Mar 11 13:11:52 CET 2024
eula=true
```

Then, if you or your friends who you are planning to play with are using cracked minecraft, you also need to go to ```server.properties``` and change ```online-mode``` to ```false```.

**do not forget to save both files!**

In the same ```server.properties``` you are also able to set difficulty, gamemode (including hardcore), max number of players, pvp, whitelist, generate structures and view distance along with other settings. I recommend to leave them default and play with them after succeeding in setting up the server to work correctly.

---

6. Run server

Run ```server.jar``` again, a GUI (a window) should appear (it might take some time). Your server is now up and running, but it's only local, meaning that only you can join it. You still should test that everything is working by going to minecraft, multiplayer mode, direct connection and type in ```localhost``` or ```127.0.0.1```. If it returns an error, try restart your game AND launcher, restart the server and restart the PC. It might be giving errors at first but then begin working normally.

---

7. Setup ```Playit.gg```

In order to make server public and open for other people, we need to setup a way for them to connect to your server. 

One of the ways to do so is by using ```Playit.gg```. [Here](https://www.youtube.com/watch?v=NK5lsDXIFnM&ab_channel=playit) is a concise tutorial by its developer ([here](https://www.reddit.com/r/SideProject/comments/iuk9z7/playitgg_a_tunneling_tool_so_you_can_host_a_game/) is a reddit tread about it). 

In a nutshell, you need to download ```Playit.gg``` from [official website](https://```Playit.gg```/download/windows), create an account/login as a guest, then create a tunnel. When created, at the very bottom of the page there is a table with attributes and values, you need one called ```Allocation (Shared IP)``` (IP) OR ```Domain (Auto Assigned)``` (Domain) - you and anyone who wants to connect to your server will need either of these two.

---

8. Try in minecraft

Run minecraft (cracked or official) of the exact same version you created your server on step 1, go to multiplayer, direct connection/add server, put there IP:port from ```Playit.gg``` page from previous step OR domain. Click connect. The only thing you need to share with your friends for them to be able to join your server is either IP or domain, provided by ```Playit.gg```. 


---

## How to run it / shut it down

### running

Run ```server.jar```, wait for it to launch. Run ```Playit.gg``` application installed on your PC, wait for it to launch. In minecraft, go to multiplayer, paste in your IP:host OR public domain of your server, auto assigned by ```Playit.gg```, click connect.

### stopping

To stop the server properly you need to shut down both ```Playit.gg``` app and ```server.jar``` app.

### If getting errors on login


If getting errors, check following:

1. **```Playit.gg```** AND **```server.jar```** are both running. Check their consoles for any errors
2. **Minecraft** is of correct version (same as server)
3. **Internet** connection is stable
4. **Java** version is correct
5. Check if **localhost** is working correctly. To do so, you won't need ```Playit.gg```, simply run ```server.jar``` and try to connect to it using ```localhost``` as described earlier in steps 1-6. 

If errors persist, try following:

1. Restart game and launcher, server.jar, ```Playit.gg``` app and/or PC
2. Disable and enable ```Playit.gg``` tunnel, try deleting it and creating a new one

## Pros/Cons

Pros:
1. Completely free
2. Safe (you do not share you own IP or open extra ports)
3. Works on both official and cracked minecraft
4. Can work with mods (search for a better instruction on that)
5. Can handle up to 20 players by default
6. You are using your own hardware for that (you can dedicate a lot of RAM and storage)
7. All files are stored on your device, noone has control over them except for you, you can change settings etc
8. You can create a whitelist and have control over connections

Cons:
1. Might be a bit problematic to setup
2. Your device has to be running for the server to be running
3. Your server will take storage space and resources of your device
4. I could figure out how to create a server of non-latest version

## Other approaches to creating a Minecraft server

1. Using hosts, like Scalacube (2.8GB, 6GB RAM for free - getting full very quickly) etc. Limited to storage space and RAM, but very easy to setup and use.

2. Using the same ```server.jar``` with port forwarding (less safe, more difficult to setup, needs access to your router).

3. Using LAN and Hamachi (not exactly a server but allows to play with friends). Might cause severe ping.

4. Minecraft Realms. Paid and works only with official minecraft
