---
title: Pentafox Engine
description: Y2A Buas project - Pentafox Game Engine
slug: pentafox
date: 2026-11-04
image: img3.png
coverHeight: full
categories:
    - English
    - Programming
    - Portfolio
tags:
    - English
    - Project
    - Programming
    - C++
    - 3D
---

## Gallery

![Editor](img1.png)
![Themes](img2.png)

![Game, inspector, scene](img3.png)
![Models, asset manager](img4.png)

{{< img src="pentafox.svg" alt="Pentafox logo" width="300" class="img-right" >}}
Unfortunately, I cannot share the project or make github page public, as well as share some code, due to an NDA.

## General overview

Pentafox Engine was written from scratch, based on a close-source XSR (extra small renderer) written by Bojan. It supports:
- Windows and Play Station 5 platforms
- basic rendering
- platform-specific input (keyboard/mouse vs controller)
- dynamic asset management
- OBJ/GLTF/image loading
- asset cooking
- DLL management
- hot DLL reload
- runtime reflection
- serialization (saving, loading, GUI)
- packaging script for windows
- basic hierarchy support
- ECS
- logging with sinks

## Technical detailed overiew

Simplest game can be as simple as this:

```cpp
#include <pentafox/api.hpp>

class MyGame : public fox::IGame
{
public:
    void init() override
    {
    }

    void update() override
    {
    }
};

FOX_REGISTER_GAME(MyGame)
``` 