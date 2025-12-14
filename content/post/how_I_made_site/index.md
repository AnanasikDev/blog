---
title: How I made this website
description: I want to share how I made this website
slug: how_i_made_site
date: 2025-12-01
categories:
    - Programming
    - English
tags:
    - English
draft: true
---

I have always wanted my personal blog website, ever since I was a kid. When I got into programming and I got both some skill and something meaningful to share my desire for it grew rapidly, but I could not make it due to lack of skill and understanding. Now, years later I managed to figure it out, and here we are, on this beautiful website. For others interested in similar results I want to share a bit of behind the scenes.

This is NOT an instruction nor am I stating that this is the only or the best way to make personal website.

## Hugo

[Hugo](https://gohugo.io/) is a static site generator which provides you with functionality such that if you want to do it the easy way - you can, but if you want to customize it all - you also can! With Hugo special language (as far as I understand it's their own) you can write page generation logic right inside your HTMLs. But more about that later. First things first - setup.

### Setup

Go to [themes](https://themes.gohugo.io/) and find one you like the most. Some even have interactive demos to help you choose.

You then download the theme from the website 

### Run

```
hugo server
```

or
```
hugo server -D
```

## Google analytics