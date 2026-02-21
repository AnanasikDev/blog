# Documentation

## Article properties

### title
title: How strong is your password?

### description
description: While updating my passwords, I pondered about their security and how easily they can be cracked

### slug
***MUST BE UNIQUE***\
slug: mypage_en

### data
*If the date is in the future, the page will not be shown until then. If format is wrong, it will break rendering*\
date: 2026-02-16

### categories
categories:\
    - English\
    *etc*\
    *unique names will create new categories, be careful with spelling*

### tags
tags:\
    - English\
    - Webapp\
    *etc*\
    *unique names will create new tags, be careful with spelling*

### image
*Image is same as cover*\
image: cover.jpg ***<--Path is relative to the article OR to website static/ directory***\
image: posts/lolly_jump/img13.jpg ***<--This path is actually at blog/static/posts/lolly_jump/img13.jpg***  

### coverHeight
*Image is same as cover. Doesn't do anything without image*\
coverHeight: full\
coverHeight: m3\
Options are stored in the stylesheet directly - at assets/scss/partials/article.scss:
- s1-s5 (small)
- m1-m5 (medium)
- l1-l7 (large)
- full
These values are not parsed by the script, instead they are substituted directly into the HTML class name as a postfix, hence SCSS classes' postfixes and these names must be equal.

### readingTime
*Display reading time at the top of the page?*\
readingTime: false\
readingTime: true

### weight
*Priority in the pagination*\
weight: 1 ***<--TOP PRIORITY***

### seealso
*Adds links at the top of the page and (if enabled per link) in pagination*\
format: - [url] | [text] | [svg icon name] | [showInList / hideInList]\ *<--Note: only showInList is checked. Anything else would be semantically equal to hideInList*
svg icons are stored in assets/icons/\
brand icon files always start with brand-\
seealso:\
     - https://github.com/AnanasikDev | GitHub | brand-github | showInList\
     - https://ananasikdeveloper.itch.io/ | Itch.io | brand-itchdotio | showInList\
     - https://www.artstation.com/ananasikfurry | Artstation | brand-artstation | showInList\
     - https://www.cgtrader.com/designers/ananasik | CGTrader | brand-cgtrader | showInList\
     - https://sketchfab.com/furryananasik | Sketchfab | brand-sketchfab | showInList\
     - https://www.turbosquid.com/Search/Artists/Ananaseek | Turbosquid | brand-turbosquid | showInList\
     - https://author.today/u/ananaseek | Author Today | brand-authortoday | showInList\
     - https://www.wattpad.com/user/AnanaSeek4Jam | Wattpad | brand-wattpad | showInList\
     - https://ananasikdev.github.io/blog/p/lolly_jump_en/ | Read in English | **language** | showInList ***<--Localize posts***

### seealsoMode
*Changes how seealso is rendered: either normally (in columns) or inline*\
seealsoMode: "inline"

### math
*Controls whether to render math using LaTeX or not*\
math: true\
math: false

### draft
*Controls whether to display the page in the pagination and recommendations or not. Default is true.*\
draft: true\
draft: false

### toc
*Controls how to display Table Of Contents (toc) on the page. Default is adapt.*\
toc: always/never/**adapt**\

# Hugo Theme Stack Starter Template

This is a quick start template for [Hugo theme Stack](https://github.com/CaiJimmy/hugo-theme-stack). It uses [Hugo modules](https://gohugo.io/hugo-modules/) feature to load the theme.

It comes with a basic theme structure and configuration. GitHub action has been set up to deploy the theme to a public GitHub page automatically. Also, there's a cron job to update the theme automatically everyday.

