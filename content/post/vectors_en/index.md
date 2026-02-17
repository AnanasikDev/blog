---
title: Interactive vectors sandbox
description: Vectors are often confusing, so I made this interactive sandbox to help people understand them better!
slug: vectors_en
date: 2026-02-17
categories:
    - English
tags:
    - English
    - Webapp
---

Vectors are fundamental to game programming. Understanding of them allows for flexible, efficient and clean code. In simple terms, a vector is a list of numbers which can be interpreted as a point in space or a direction.

Basis is a very simple concept. 

N-dimensional vectors have N **independent** values, meaning each one of them has a unique meaning that cannot be described using other dimensions. So for a 2D vector (X, Y), changing X will never affect Y and vice versa.


For an N-dimensional space, be it 2D or 3D for instance, given a "good" (will be explained later) set of "starting" vectors, we can combine them in specific proportions to get all vectors in the N-dimensional space. Take a look at this 2D example:

{{< vectors_ij >}}

This principle is called *linear independency*, and those values X and Y are called *lineraly independent*.

{{< vectors_sandbox >}}



The app was made using Google Gemini.